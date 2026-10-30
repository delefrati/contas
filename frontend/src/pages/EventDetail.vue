<script setup>
import { onMounted, onBeforeUnmount, ref, computed, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import AppHeader from '../components/AppHeader.vue'
import Modal from '../components/Modal.vue'
import EventFormModal from '../components/EventFormModal.vue'
import StageView from '../components/StageView.vue'
import { formatDate as formatLocalDate, localeTag, parseDate } from '../utils/date'
import { eventName, typeStyle } from '../utils/events'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { logout, getAuthHeader, getCurrentUser } = useAuth()
const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

const event = ref(null)
const songs = ref([])
const types = ref([])

const loading = ref(false)
const error = ref('')
const successMessage = ref('')
const printing = ref(false)
const printedAt = ref('')
const printColumns = ref(1)
const printFontSize = ref(24)
const savingSongs = ref(false)
const songFilter = ref('')

const isEventModalOpen = ref(false)

// Copy setlist
const isCopyModalOpen = ref(false)
const copyDate = ref('')
const copyTargets = ref([])
const copyTargetId = ref('new')
const copyNewTypeId = ref(null)
const copying = ref(false)

const eventId = computed(() => Number(route.params.id))

const agendaLink = computed(() =>
  event.value ? { path: '/agenda', query: { mes: event.value.date.slice(0, 7) } } : '/agenda',
)

const filteredSongs = computed(() => {
  const term = songFilter.value.trim().toLowerCase()
  if (!term) return songs.value
  return songs.value.filter((s) =>
    (s.title || '').toLowerCase().includes(term) ||
    (s.artist || '').toLowerCase().includes(term),
  )
})

const availableSongs = computed(() => {
  if (!event.value) return []
  const usedIds = new Set(
    event.value.setlist
      .filter((s) => s.type === 'song')
      .map((s) => s.songId),
  )
  return filteredSongs.value.filter((s) => !usedIds.has(s.id))
})

// Remembered per browser: artists get in the way when the text is pasted into a formatted doc
const SHOW_ARTISTS_KEY = 'repertoire_show_artists'

function readShowArtists() {
  try {
    return localStorage.getItem(SHOW_ARTISTS_KEY) === 'true'
  } catch {
    return false
  }
}

const showArtists = ref(readShowArtists())

watch(showArtists, (value) => {
  try {
    localStorage.setItem(SHOW_ARTISTS_KEY, String(value))
  } catch {
    // Not persisting the preference is fine
  }
})

const printStyle = computed(() => ({
  '--repertoire-print-columns': String(printColumns.value),
  '--repertoire-print-font-size': `${printFontSize.value}pt`,
}))

const canDecreasePrintFont = computed(() => printFontSize.value > 12)
const canIncreasePrintFont = computed(() => printFontSize.value < 40)

function decreasePrintFont() {
  if (printFontSize.value > 12) {
    printFontSize.value -= 2
  }
}

function increasePrintFont() {
  if (printFontSize.value < 40) {
    printFontSize.value += 2
  }
}

// Phone view for reading the setlist on stage. It lives in the URL so the phone's
// back button leaves the view instead of the page.
const STAGE_QUERY = 'visualizar'
const isStageOpen = computed(() => route.query[STAGE_QUERY] === '1')

function openStage() {
  router.push({ query: { ...route.query, [STAGE_QUERY]: '1' } })
}

function closeStage() {
  const { [STAGE_QUERY]: _, ...query } = route.query
  // Opened from this page: go back so the view doesn't linger in history
  if (window.history.state?.back === router.resolve({ query }).fullPath) {
    router.back()
  } else {
    router.replace({ query })
  }
}

function songNumber(index) {
  if (!event.value) return 0
  let n = 0
  for (let i = 0; i <= index; i++) {
    if (event.value.setlist[i]?.type !== 'pause') n++
  }
  return n
}

function pauseText(item) {
  return item.label ? `-- ${item.label} --` : '-----'
}

function showSuccess(message) {
  successMessage.value = '✓ ' + message
  setTimeout(() => { successMessage.value = '' }, 3000)
}

function handleError(exception) {
  error.value = exception instanceof Error ? exception.message : t('errors.genericError')
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const authHeader = getAuthHeader()
    const responses = await Promise.all([
      fetch(`${apiBaseUrl}/api/events/${eventId.value}`, { headers: authHeader }),
      fetch(`${apiBaseUrl}/api/songs`, { headers: authHeader }),
      fetch(`${apiBaseUrl}/api/event-types`, { headers: authHeader }),
    ])
    const [eventResponse, songsResponse, typesResponse] = responses

    if (responses.some((response) => response.status === 401)) {
      await logout()
      await router.push({ path: '/login', query: { reason: 'expired' } })
      return
    }

    if (eventResponse.status === 404) {
      event.value = null
      throw new Error(t('agenda.notFound'))
    }
    if (responses.some((response) => !response.ok)) {
      throw new Error(t('agenda.loadingError'))
    }

    event.value = (await eventResponse.json()).data
    songs.value = (await songsResponse.json()).data || []
    types.value = (await typesResponse.json()).data || []
  } catch (exception) {
    handleError(exception)
  } finally {
    loading.value = false
  }
}

// ---- Event ----
function onEventSaved(saved) {
  event.value = saved
  showSuccess(t('agenda.successUpdate'))
}

async function deleteEvent() {
  if (!confirm(t('agenda.confirmDelete', { name: eventName(event.value), date: formatDate(event.value.date) }))) return
  try {
    const response = await fetch(`${apiBaseUrl}/api/events/${event.value.id}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    })
    if (!response.ok) throw new Error(t('errors.genericError'))
    await router.push(agendaLink.value)
  } catch (exception) {
    handleError(exception)
  }
}

// ---- Builder: add / remove / reorder ----
let tempKeySeq = -1

function setlistItems(setlist) {
  return setlist.map((it) =>
    it.type === 'pause'
      ? { type: 'pause', label: (it.label || '').trim() }
      : { type: 'song', songId: it.songId },
  )
}

async function persistOrder() {
  if (!event.value) return
  savingSongs.value = true
  error.value = ''
  try {
    const response = await fetch(`${apiBaseUrl}/api/events/${event.value.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ items: setlistItems(event.value.setlist) }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.message || t('errors.genericError'))
    }
    event.value = (await response.json()).data
  } catch (exception) {
    handleError(exception)
    // Reload authoritative state on failure
    await loadData()
  } finally {
    savingSongs.value = false
  }
}

function addSong(song) {
  if (!event.value) return
  event.value.setlist.push({
    id: tempKeySeq--,
    type: 'song',
    songId: song.id,
    title: song.title,
    artist: song.artist,
    notes: song.notes,
    position: event.value.setlist.length,
  })
  persistOrder()
}

function addPause() {
  if (!event.value) return
  event.value.setlist.push({
    id: tempKeySeq--,
    type: 'pause',
    songId: null,
    title: null,
    artist: null,
    notes: null,
    label: '',
    position: event.value.setlist.length,
  })
  persistOrder()
}

function removeSong(index) {
  if (!event.value) return
  event.value.setlist.splice(index, 1)
  persistOrder()
}

function moveSong(index, delta) {
  if (!event.value) return
  const list = event.value.setlist
  const target = index + delta
  if (target < 0 || target >= list.length) return
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item)
  persistOrder()
}

// Native drag-and-drop reordering
const dragIndex = ref(null)

function onDragStart(index) {
  dragIndex.value = index
}

function onDrop(index) {
  if (dragIndex.value === null || dragIndex.value === index) {
    dragIndex.value = null
    return
  }
  const list = event.value.setlist
  const [item] = list.splice(dragIndex.value, 1)
  list.splice(index, 0, item)
  dragIndex.value = null
  persistOrder()
}

// ---- Copy setlist to another date ----
function openCopy() {
  copyDate.value = ''
  copyTargets.value = []
  copyTargetId.value = 'new'
  // Same type as this event, unless it was deleted meanwhile
  copyNewTypeId.value = types.value.some((type) => type.id === event.value.typeId)
    ? event.value.typeId
    : types.value[0]?.id ?? null
  isCopyModalOpen.value = true
}

watch(copyDate, async (date) => {
  copyTargets.value = []
  copyTargetId.value = 'new'
  if (!date) return
  try {
    const response = await fetch(`${apiBaseUrl}/api/events?from=${date}&to=${date}`, {
      headers: getAuthHeader(),
    })
    if (!response.ok) throw new Error(t('errors.genericError'))
    const targets = ((await response.json()).data || []).filter((e) => e.id !== event.value.id)
    // Ignore answers for a date the user already moved away from
    if (copyDate.value !== date) return
    copyTargets.value = targets
    if (targets.length > 0) copyTargetId.value = targets[0].id
  } catch (exception) {
    handleError(exception)
  }
})

async function submitCopy() {
  if (!copyDate.value) {
    error.value = t('repertoires.copyDateRequired')
    return
  }

  const target = copyTargets.value.find((e) => e.id === copyTargetId.value)
  if (target?.songCount > 0 &&
      !confirm(t('repertoires.copyConfirmReplace', { name: eventName(target), count: target.songCount }))) {
    return
  }

  copying.value = true
  error.value = ''
  try {
    const items = setlistItems(event.value.setlist)
    const response = target
      ? await fetch(`${apiBaseUrl}/api/events/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ items }),
      })
      : await fetch(`${apiBaseUrl}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ typeId: copyNewTypeId.value, date: copyDate.value, items }),
      })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.message || t('errors.genericError'))
    }

    const copied = (await response.json()).data
    isCopyModalOpen.value = false
    await router.push(`/agenda/${copied.id}`)
    showSuccess(t('repertoires.copySuccess'))
  } catch (exception) {
    handleError(exception)
  } finally {
    copying.value = false
  }
}

function formatDate(dateStr) {
  return formatLocalDate(dateStr, locale.value, '—')
}

function formatLongDate(dateStr) {
  const text = parseDate(dateStr).toLocaleDateString(localeTag(locale.value), {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function formatEventTarget(target) {
  const parts = [target.type.name]
  if (target.title) parts.push(target.title)
  if (target.time) parts.push(target.time)
  return `${parts.join(' · ')} (${t('agenda.songCount', target.songCount)})`
}

let originalTitle = ''

function buildRepertoireText(current) {
  const lines = [eventName(current)]
  lines.push([formatDate(current.date), current.time].filter(Boolean).join(' · '))
  if (current.location) lines.push(current.location)
  lines.push('')

  current.setlist.forEach((item, index) => {
    if (item.type === 'pause') {
      lines.push(pauseText(item))
    } else {
      const artist = showArtists.value && item.artist ? ` — ${item.artist}` : ''
      lines.push(`${songNumber(index)}. ${item.title}${artist}`)
    }
  })

  return lines.join('\n')
}

async function shareRepertoire() {
  if (!event.value) return
  const text = buildRepertoireText(event.value)
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      throw new Error('clipboard unavailable')
    }
    showSuccess(t('repertoires.shareSuccess'))
  } catch {
    window.prompt(t('repertoires.shareFallbackHint'), text)
  }
}

async function printRepertoire() {
  printing.value = true
  originalTitle = document.title
  if (event.value) {
    document.title = `${eventName(event.value)} ${formatDate(event.value.date)}`
  }
  await nextTick()
  window.print()
}

function setPrintedAt() {
  printedAt.value = new Date().toLocaleString(localeTag(locale.value))
}

function onAfterPrint() {
  printing.value = false
  if (originalTitle) document.title = originalTitle
}

// Copying navigates to another event without leaving this page
watch(eventId, () => {
  songFilter.value = ''
  loadData()
})

onMounted(async () => {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    await router.push('/login')
    return
  }

  loadData()
  window.addEventListener('beforeprint', setPrintedAt)
  window.addEventListener('afterprint', onAfterPrint)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeprint', setPrintedAt)
  window.removeEventListener('afterprint', onAfterPrint)
})
</script>

<template>
  <div class="container">
    <AppHeader icon="fa-calendar-days" :title="$t('agenda.title')" class="no-print" />

    <!-- Printable setlist page -->
    <div
      v-if="printing && event"
      class="repertoire-print print-only"
      :class="{ 'is-two-columns': printColumns === 2 }"
      :style="printStyle"
    >
      <ol class="print-song-list">
        <template v-for="(item, index) in event.setlist" :key="item.id">
          <li v-if="item.type !== 'pause'" :value="songNumber(index)">
            <span class="print-song-title">{{ item.title }}</span>
            <span v-if="showArtists && item.artist" class="print-song-artist"> — {{ item.artist }}</span>
          </li>
          <li v-else class="print-pause">
            <span class="print-pause-line">{{ pauseText(item) }}</span>
          </li>
        </template>
      </ol>
      <p v-if="event.setlist.length === 0" class="empty-state">{{ $t('repertoires.noSongs') }}</p>
    </div>

    <Teleport to="body">
      <StageView
        v-if="isStageOpen && event"
        class="no-print"
        :setlist="event.setlist"
        :show-artists="showArtists"
        @close="closeStage"
      />
    </Teleport>

    <div class="no-print">
    <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div class="content">
      <router-link :to="agendaLink" class="back-link">
        <i class="fa-solid fa-arrow-left"></i> {{ $t('agenda.back') }}
      </router-link>

      <div v-if="loading && !event" class="loading">
        <i class="fa-solid fa-spinner fa-spin"></i> {{ $t('actions.loading') }}
      </div>

      <template v-if="event">
        <section class="expenses-section event-card" :style="typeStyle(event.type)">
          <div class="event-heading">
            <div>
              <span class="type-tag">{{ event.type.name }}</span>
              <h2>{{ eventName(event) }}</h2>
            </div>
            <div class="section-actions">
              <button @click="isEventModalOpen = true" class="btn-secondary" :title="$t('actions.edit')">
                <i class="fa-solid fa-pencil"></i> {{ $t('actions.edit') }}
              </button>
              <button @click="deleteEvent" class="btn-delete" :title="$t('actions.delete')" :aria-label="$t('actions.delete')">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
          <ul class="event-facts">
            <li><i class="fa-regular fa-calendar"></i> {{ formatLongDate(event.date) }}</li>
            <li v-if="event.time"><i class="fa-regular fa-clock"></i> {{ event.time }}</li>
            <li v-if="event.location"><i class="fa-solid fa-location-dot"></i> {{ event.location }}</li>
          </ul>
          <p v-if="event.notes" class="event-notes">{{ event.notes }}</p>
        </section>

        <section class="expenses-section builder">
          <div class="section-header builder-header">
            <h2>{{ $t('repertoires.title') }}</h2>
            <div class="section-actions">
              <span v-if="savingSongs" class="saving-indicator"><i class="fa-solid fa-spinner fa-spin"></i></span>
              <div class="print-controls" :title="$t('repertoires.printSettings')">
                <label class="print-control">
                  <span>{{ $t('repertoires.printColumns') }}</span>
                  <select v-model.number="printColumns">
                    <option :value="1">1</option>
                    <option :value="2">2</option>
                  </select>
                </label>
                <label class="print-control">
                  <span>{{ $t('repertoires.printArtists') }}</span>
                  <select v-model="showArtists">
                    <option :value="true">{{ $t('repertoires.showArtists') }}</option>
                    <option :value="false">{{ $t('repertoires.hideArtists') }}</option>
                  </select>
                </label>
                <div class="print-control">
                  <span>{{ $t('repertoires.printFontSize') }}</span>
                  <div class="font-stepper">
                    <button type="button" class="btn-step" :disabled="!canDecreasePrintFont" @click="decreasePrintFont" title="Diminuir fonte">A-</button>
                    <span class="font-size-value">{{ printFontSize }}pt</span>
                    <button type="button" class="btn-step" :disabled="!canIncreasePrintFont" @click="increasePrintFont" title="Aumentar fonte">A+</button>
                  </div>
                </div>
              </div>
              <button @click="openStage" :disabled="event.setlist.length === 0" class="btn-secondary" :title="$t('repertoires.stageViewHint')">
                <i class="fa-solid fa-mobile-screen"></i> {{ $t('repertoires.stageView') }}
              </button>
              <button @click="openCopy" :disabled="event.setlist.length === 0" class="btn-secondary" :title="$t('repertoires.copy')">
                <i class="fa-solid fa-copy"></i> {{ $t('repertoires.copy') }}
              </button>
              <button @click="shareRepertoire" class="btn-secondary" :title="$t('repertoires.shareText')">
                <i class="fa-solid fa-share-nodes"></i> {{ $t('repertoires.shareText') }}
              </button>
              <button @click="printRepertoire" class="btn-primary" :title="$t('app.print')">
                <i class="fa-solid fa-print"></i> {{ $t('app.print') }}
              </button>
            </div>
          </div>

          <div class="builder-columns">
            <!-- Current setlist (ordered, reorderable) -->
            <div class="builder-panel">
              <div class="panel-head">
                <h3>{{ $t('repertoires.songsInList') }} ({{ event.setlist.length }})</h3>
                <button @click="addPause" class="btn-secondary btn-sm" :title="$t('repertoires.addPauseHint')">
                  <i class="fa-solid fa-grip-lines"></i> {{ $t('repertoires.addPause') }}
                </button>
              </div>
              <p class="hint">{{ $t('repertoires.reorderHint') }}</p>
              <ol v-if="event.setlist.length > 0" class="song-order-list">
                <li
                  v-for="(song, index) in event.setlist"
                  :key="song.id"
                  class="song-order-item"
                  :class="{ 'is-pause': song.type === 'pause' }"
                  draggable="true"
                  @dragstart="onDragStart(index)"
                  @dragover.prevent
                  @drop="onDrop(index)"
                >
                  <span class="drag-handle" :title="$t('repertoires.drag')"><i class="fa-solid fa-grip-vertical"></i></span>
                  <template v-if="song.type === 'pause'">
                    <span class="pause-icon" :title="$t('repertoires.pause')"><i class="fa-solid fa-grip-lines"></i></span>
                    <input
                      type="text"
                      v-model="song.label"
                      @change="persistOrder"
                      :placeholder="$t('repertoires.pauseLabelPlaceholder')"
                      class="pause-label-input"
                    />
                  </template>
                  <template v-else>
                    <span class="song-position">{{ songNumber(index) }}</span>
                    <span class="song-name">
                      {{ song.title }}
                      <small v-if="song.artist">— {{ song.artist }}</small>
                    </span>
                  </template>
                  <span class="order-actions">
                    <button @click="moveSong(index, -1)" :disabled="index === 0" class="btn-icon" :title="$t('repertoires.moveUp')">
                      <i class="fa-solid fa-chevron-up"></i>
                    </button>
                    <button @click="moveSong(index, 1)" :disabled="index === event.setlist.length - 1" class="btn-icon" :title="$t('repertoires.moveDown')">
                      <i class="fa-solid fa-chevron-down"></i>
                    </button>
                    <button @click="removeSong(index)" class="btn-icon btn-icon-danger" :title="$t('repertoires.remove')">
                      <i class="fa-solid fa-xmark"></i>
                    </button>
                  </span>
                </li>
              </ol>
              <div v-else class="empty-state"><p>{{ $t('repertoires.noSongs') }}</p></div>
            </div>

            <!-- Available songs to add -->
            <div class="builder-panel">
              <h3>{{ $t('repertoires.availableSongs') }}</h3>
              <input type="text" v-model="songFilter" :placeholder="$t('songs.filterPlaceholder')" class="search-input full" />
              <div v-if="availableSongs.length === 0" class="empty-state"><p>{{ $t('repertoires.allAdded') }}</p></div>
              <ul v-else class="available-list">
                <li v-for="song in availableSongs" :key="song.id" class="available-item">
                  <span class="song-name">
                    {{ song.title }}
                    <small v-if="song.artist">— {{ song.artist }}</small>
                  </span>
                  <button @click="addSong(song)" class="btn-icon btn-icon-add" :title="$t('repertoires.add')">
                    <i class="fa-solid fa-plus"></i>
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </template>
    </div>

    <EventFormModal v-model="isEventModalOpen" :event="event" :types="types" @saved="onEventSaved" />

    <!-- Copy setlist modal -->
    <Modal v-model="isCopyModalOpen" :title="$t('repertoires.copyTitle')">
      <form @submit.prevent="submitCopy" class="form">
        <p class="hint">{{ $t('repertoires.copyHint') }}</p>
        <div class="form-group">
          <label>{{ $t('agenda.date') }} *</label>
          <input type="date" v-model="copyDate" required />
        </div>
        <fieldset v-if="copyDate" class="form-group copy-targets">
          <legend>{{ $t('repertoires.copyTarget') }}</legend>
          <label v-for="target in copyTargets" :key="target.id" class="copy-target">
            <input type="radio" :value="target.id" v-model="copyTargetId" />
            <span>{{ formatEventTarget(target) }}</span>
          </label>
          <label class="copy-target">
            <input type="radio" value="new" v-model="copyTargetId" />
            <span>{{ $t('repertoires.copyNewEvent') }}</span>
            <select v-if="copyTargetId === 'new'" v-model="copyNewTypeId" :aria-label="$t('agenda.type')">
              <option v-for="type in types" :key="type.id" :value="type.id">{{ type.name }}</option>
            </select>
          </label>
        </fieldset>
        <div class="form-actions">
          <button type="button" @click="isCopyModalOpen = false" class="btn-secondary">{{ $t('actions.cancel') }}</button>
          <button type="submit" :disabled="copying || !copyDate" class="btn-primary">
            {{ copying ? $t('actions.loading') : $t('repertoires.copySubmit') }}
          </button>
        </div>
      </form>
    </Modal>
    </div>
  </div>
</template>

<style scoped>
.back-link {
  align-self: flex-start;
  color: var(--accent);
  font-weight: 600;
  text-decoration: none;
}
.back-link:hover {
  text-decoration: underline;
}
.event-card {
  border-left: 4px solid var(--type-color);
}
.event-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}
.event-heading > div:first-child {
  text-align: left;
}
.event-heading h2 {
  margin: 6px 0 0;
  text-align: left;
  overflow-wrap: anywhere;
}
.event-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
  color: var(--text-light);
}
.event-notes {
  margin: 10px 0 0;
  white-space: pre-line;
  text-align: left;
}
.search-input {
  padding: 8px 12px;
  border: 1px solid var(--border-color, #ccc);
  border-radius: 6px;
  font-size: 0.95rem;
}
.search-input.full {
  width: 100%;
  margin-bottom: 12px;
}
.builder-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}
.builder-header h2 {
  margin: 0;
}
.saving-indicator {
  opacity: 0.6;
}
.print-controls {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.print-control {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 86px;
}
.print-control span {
  font-size: 0.72rem;
  color: var(--text-light, #718096);
  line-height: 1;
}
.print-control select {
  padding: 4px 8px;
  border: 1px solid var(--border-color, #ccc);
  border-radius: 6px;
  background: var(--bg-white, #fff);
  color: var(--text-h, #1a202c);
  font-size: 0.82rem;
}
.font-stepper {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--border-color, #ccc);
  border-radius: 6px;
  overflow: hidden;
  background: var(--bg-white, #fff);
}
.btn-step {
  border: none;
  background: transparent;
  color: var(--text-h, #1a202c);
  font-size: 0.78rem;
  font-weight: 700;
  padding: 4px 8px;
  cursor: pointer;
}
.btn-step:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.06);
}
.btn-step:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.font-size-value {
  min-width: 54px;
  text-align: center;
  font-size: 0.82rem;
  font-weight: 600;
  padding: 0 8px;
  color: var(--text-h, #1a202c);
}
.builder-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-top: 16px;
}
@media (max-width: 768px) {
  .builder-columns {
    grid-template-columns: 1fr;
  }
}
.builder-panel h3 {
  margin: 0 0 4px;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.btn-sm {
  padding: 4px 10px;
  font-size: 0.8rem;
}
.hint {
  font-size: 0.8rem;
  opacity: 0.65;
  margin: 0 0 10px;
}
.song-order-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.song-order-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  margin-bottom: 6px;
  background: var(--bg-white, #fff);
  color: var(--text-h, #1a202c);
  cursor: grab;
}
.song-order-item:active {
  cursor: grabbing;
}
.song-order-item.is-pause {
  background: repeating-linear-gradient(
    45deg,
    rgba(0, 0, 0, 0.03),
    rgba(0, 0, 0, 0.03) 6px,
    transparent 6px,
    transparent 12px
  );
  border-style: dashed;
}
.pause-icon {
  opacity: 0.6;
  color: var(--text-light, #718096);
}
.pause-label-input {
  flex: 1;
  font-weight: 600;
  letter-spacing: 0.04em;
  font-size: 0.85rem;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-h, #1a202c);
  font-family: inherit;
}
.pause-label-input::placeholder {
  text-transform: uppercase;
  opacity: 0.6;
  font-weight: 600;
  letter-spacing: 0.08em;
}
.pause-label-input:hover,
.pause-label-input:focus {
  border-color: var(--border-color, #e2e8f0);
  background: var(--bg-white, #fff);
  outline: none;
}
.drag-handle {
  opacity: 0.7;
  color: var(--text-light, #718096);
  cursor: grab;
}
.song-position {
  font-weight: 700;
  min-width: 22px;
  text-align: right;
  color: var(--text-light, #718096);
}
.song-name {
  flex: 1;
  color: var(--text-h, #1a202c);
}
.song-name small {
  color: var(--text-light, #718096);
  opacity: 1;
}
.order-actions {
  display: flex;
  gap: 4px;
}
.available-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 480px;
  overflow-y: auto;
}
.available-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-color, #eee);
  color: var(--text-h, #1a202c);
}
.btn-icon {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 6px;
  color: inherit;
}
.btn-icon:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.btn-icon:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.06);
}
.btn-icon-danger:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.12);
  color: #dc2626;
}
.btn-icon-add:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
}
.form-group {
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-group input[type='date'] {
  padding: 8px 12px;
  border: 1px solid var(--border-color, #ccc);
  border-radius: 6px;
  font-size: 0.95rem;
  font-family: inherit;
}
.copy-targets {
  border: none;
  padding: 0;
}
.copy-targets legend {
  margin-bottom: 6px;
  font-weight: 600;
}
.copy-target {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
}
.copy-target input {
  width: auto;
}
.copy-target select {
  margin-left: auto;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}
</style>
