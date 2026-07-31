<script setup>
import { onMounted, ref, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import LanguageSelector from '../components/LanguageSelector.vue'
import Modal from '../components/Modal.vue'

const { t, locale } = useI18n()
const router = useRouter()
const { logout, getAuthHeader, member, getCurrentUser } = useAuth()
const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001'

const songs = ref([])
const repertoires = ref([])
const currentRepertoire = ref(null)

const loading = ref(false)
const error = ref('')
const successMessage = ref('')
const activeTab = ref('songs')
const showLanguageSelector = ref(false)
const printing = ref(false)
const printedAt = ref('')
const printColumns = ref(1)
const printFontSize = ref(24)

// Song form
const isSongModalOpen = ref(false)
const editingSong = ref(null)
const songForm = ref({ title: '', artist: '', notes: '' })
const savingSong = ref(false)
const songFilter = ref('')

// Song import
const isImportModalOpen = ref(false)
const importText = ref('')
const importing = ref(false)
const importResult = ref(null)

// Repertoire creation
const isRepertoireModalOpen = ref(false)
const editingRepertoire = ref(null)
const repertoireForm = ref({ name: '', date: new Date().toISOString().slice(0, 10) })
const savingRepertoire = ref(false)

// Builder
const savingSongs = ref(false)

const filteredSongs = computed(() => {
  const term = songFilter.value.trim().toLowerCase()
  if (!term) return songs.value
  return songs.value.filter((s) =>
    (s.title || '').toLowerCase().includes(term) ||
    (s.artist || '').toLowerCase().includes(term),
  )
})

const availableSongs = computed(() => {
  if (!currentRepertoire.value) return []
  const usedIds = new Set(
    (currentRepertoire.value.songs || [])
      .filter((s) => s.type === 'song')
      .map((s) => s.songId),
  )
  return filteredSongs.value.filter((s) => !usedIds.has(s.id))
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

function songNumber(index) {
  if (!currentRepertoire.value) return 0
  let n = 0
  for (let i = 0; i <= index; i++) {
    if (currentRepertoire.value.songs[i]?.type !== 'pause') n++
  }
  return n
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
    const [songsResponse, repertoiresResponse] = await Promise.all([
      fetch(`${apiBaseUrl}/api/songs`, { headers: authHeader }),
      fetch(`${apiBaseUrl}/api/repertoires`, { headers: authHeader }),
    ])

    if (songsResponse.status === 401 || repertoiresResponse.status === 401) {
      await logout()
      await router.push({ path: '/login', query: { reason: 'expired' } })
      return
    }

    if (!songsResponse.ok || !repertoiresResponse.ok) {
      throw new Error(t('songs.loadingError'))
    }

    songs.value = (await songsResponse.json()).data || []
    repertoires.value = (await repertoiresResponse.json()).data || []
  } catch (exception) {
    handleError(exception)
  } finally {
    loading.value = false
  }
}

// ---- Songs CRUD ----
function openCreateSong() {
  editingSong.value = null
  songForm.value = { title: '', artist: '', notes: '' }
  isSongModalOpen.value = true
}

function openEditSong(song) {
  editingSong.value = song
  songForm.value = { title: song.title, artist: song.artist || '', notes: song.notes || '' }
  isSongModalOpen.value = true
}

async function saveSong() {
  const title = songForm.value.title.trim()
  if (!title) {
    error.value = t('songs.titleRequired')
    return
  }

  savingSong.value = true
  error.value = ''
  try {
    const payload = {
      title,
      artist: songForm.value.artist.trim(),
      notes: songForm.value.notes.trim(),
    }
    const url = editingSong.value
      ? `${apiBaseUrl}/api/songs/${editingSong.value.id}`
      : `${apiBaseUrl}/api/songs`
    const method = editingSong.value ? 'PATCH' : 'POST'

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.message || t('errors.genericError'))
    }

    isSongModalOpen.value = false
    showSuccess(editingSong.value ? t('songs.successUpdate') : t('songs.successCreate'))
    await loadData()
  } catch (exception) {
    handleError(exception)
  } finally {
    savingSong.value = false
  }
}

async function deleteSong(song) {
  if (!confirm(t('songs.confirmDelete', { title: song.title }))) return
  try {
    const response = await fetch(`${apiBaseUrl}/api/songs/${song.id}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    })
    if (!response.ok) throw new Error(t('errors.genericError'))
    showSuccess(t('songs.successDelete'))
    await loadData()
    if (currentRepertoire.value) await openRepertoire(currentRepertoire.value.id)
  } catch (exception) {
    handleError(exception)
  }
}

function openImport() {
  importText.value = ''
  importResult.value = null
  isImportModalOpen.value = true
}

async function submitImport() {
  if (!importText.value.trim()) {
    error.value = t('songs.importEmpty')
    return
  }

  importing.value = true
  error.value = ''
  importResult.value = null
  try {
    const response = await fetch(`${apiBaseUrl}/api/songs/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ text: importText.value }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.message || t('errors.genericError'))
    }

    const result = (await response.json()).data
    importResult.value = result
    showSuccess(t('songs.importSuccess', { created: result.created, skipped: result.skipped }))
    await loadData()
    if (result.skipped === 0) {
      isImportModalOpen.value = false
    }
  } catch (exception) {
    handleError(exception)
  } finally {
    importing.value = false
  }
}

// ---- Repertoire CRUD ----
function openCreateRepertoire() {
  editingRepertoire.value = null
  repertoireForm.value = { name: '', date: new Date().toISOString().slice(0, 10) }
  isRepertoireModalOpen.value = true
}

function openEditRepertoire(repertoire) {
  editingRepertoire.value = repertoire
  repertoireForm.value = { name: repertoire.name, date: repertoire.date || new Date().toISOString().slice(0, 10) }
  isRepertoireModalOpen.value = true
}

async function saveRepertoire() {
  const name = repertoireForm.value.name.trim()
  if (!name) {
    error.value = t('repertoires.nameRequired')
    return
  }

  savingRepertoire.value = true
  error.value = ''
  try {
    const payload = { name, date: repertoireForm.value.date }
    const url = editingRepertoire.value
      ? `${apiBaseUrl}/api/repertoires/${editingRepertoire.value.id}`
      : `${apiBaseUrl}/api/repertoires`
    const method = editingRepertoire.value ? 'PATCH' : 'POST'

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.message || t('errors.genericError'))
    }

    const saved = (await response.json()).data
    isRepertoireModalOpen.value = false
    showSuccess(editingRepertoire.value ? t('repertoires.successUpdate') : t('repertoires.successCreate'))
    await loadData()

    // Open the freshly created repertoire so the user can start building it
    if (!editingRepertoire.value && saved?.id) {
      await openRepertoire(saved.id)
    } else if (currentRepertoire.value?.id === saved?.id) {
      await openRepertoire(saved.id)
    }
  } catch (exception) {
    handleError(exception)
  } finally {
    savingRepertoire.value = false
  }
}

async function deleteRepertoire(repertoire) {
  if (!confirm(t('repertoires.confirmDelete', { name: repertoire.name }))) return
  try {
    const response = await fetch(`${apiBaseUrl}/api/repertoires/${repertoire.id}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    })
    if (!response.ok) throw new Error(t('errors.genericError'))
    if (currentRepertoire.value?.id === repertoire.id) currentRepertoire.value = null
    showSuccess(t('repertoires.successDelete'))
    await loadData()
  } catch (exception) {
    handleError(exception)
  }
}

async function openRepertoire(id) {
  error.value = ''
  try {
    const response = await fetch(`${apiBaseUrl}/api/repertoires/${id}`, {
      headers: getAuthHeader(),
    })
    if (!response.ok) throw new Error(t('errors.genericError'))
    currentRepertoire.value = (await response.json()).data
  } catch (exception) {
    handleError(exception)
  }
}

function closeRepertoire() {
  currentRepertoire.value = null
}

// ---- Builder: add / remove / reorder ----
let tempKeySeq = -1

async function persistOrder() {
  if (!currentRepertoire.value) return
  savingSongs.value = true
  error.value = ''
  try {
    const items = currentRepertoire.value.songs.map((it) =>
      it.type === 'pause' ? { type: 'pause' } : { type: 'song', songId: it.songId },
    )
    const response = await fetch(`${apiBaseUrl}/api/repertoires/${currentRepertoire.value.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ items }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.message || t('errors.genericError'))
    }
    currentRepertoire.value = (await response.json()).data
    await loadData()
  } catch (exception) {
    handleError(exception)
    // Reload authoritative state on failure
    if (currentRepertoire.value) await openRepertoire(currentRepertoire.value.id)
  } finally {
    savingSongs.value = false
  }
}

function addSong(song) {
  if (!currentRepertoire.value) return
  currentRepertoire.value.songs.push({
    id: tempKeySeq--,
    type: 'song',
    songId: song.id,
    title: song.title,
    artist: song.artist,
    notes: song.notes,
    position: currentRepertoire.value.songs.length,
  })
  persistOrder()
}

function addPause() {
  if (!currentRepertoire.value) return
  currentRepertoire.value.songs.push({
    id: tempKeySeq--,
    type: 'pause',
    songId: null,
    title: null,
    artist: null,
    notes: null,
    position: currentRepertoire.value.songs.length,
  })
  persistOrder()
}

function removeSong(index) {
  if (!currentRepertoire.value) return
  currentRepertoire.value.songs.splice(index, 1)
  persistOrder()
}

function moveSong(index, delta) {
  if (!currentRepertoire.value) return
  const list = currentRepertoire.value.songs
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
  const list = currentRepertoire.value.songs
  const [item] = list.splice(dragIndex.value, 1)
  list.splice(index, 0, item)
  dragIndex.value = null
  persistOrder()
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString(locale.value === 'pt' ? 'pt-BR' : locale.value, {
      year: 'numeric', month: '2-digit', day: '2-digit',
    })
  } catch {
    return dateStr
  }
}

let originalTitle = ''

async function printRepertoire() {
  printing.value = true
  originalTitle = document.title
  if (currentRepertoire.value) {
    document.title = currentRepertoire.value.name
  }
  await nextTick()
  window.print()
}

function setPrintedAt() {
  printedAt.value = new Date().toLocaleString(locale.value === 'pt' ? 'pt-BR' : locale.value)
}

async function handleLogout() {
  if (confirm(t('app.confirmLogout'))) {
    await logout()
    router.push('/login')
  }
}

onMounted(async () => {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    await router.push('/login')
    return
  }

  loadData()
  window.addEventListener('beforeprint', setPrintedAt)
  window.addEventListener('afterprint', () => {
    printing.value = false
    if (originalTitle) document.title = originalTitle
  })
})
</script>

<template>
  <div class="container">
    <header class="header no-print">
      <div class="header-top">
        <h1><i class="fa-solid fa-music"></i> {{ $t('repertoire.title') }}</h1>
        <div class="header-controls">
          <button @click="router.push('/dashboard')" class="btn-secondary" :title="$t('app.title')">
            <i class="fa-solid fa-coins"></i>
          </button>
          <button @click="showLanguageSelector = !showLanguageSelector" class="btn-secondary btn-lang-toggle" :title="$t('app.language')">
            <i class="fa-solid fa-globe"></i>
          </button>
          <LanguageSelector v-if="showLanguageSelector" />
          <div v-if="member" class="user-info">
            <span class="user-name">{{ member.name }}</span>
          </div>
          <button @click="handleLogout" class="btn-logout" :title="$t('app.logout')">
            <i class="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
      </div>
    </header>

    <!-- Printable repertoire page -->
    <div
      v-if="printing && currentRepertoire"
      class="repertoire-print print-only"
      :class="{ 'is-two-columns': printColumns === 2 }"
      :style="printStyle"
    >
      <div class="print-header">
        <h1>{{ currentRepertoire.name }}</h1>
        <p class="print-meta">{{ formatDate(currentRepertoire.date) }}</p>
        <p class="print-meta">{{ $t('app.printedOn') }}: {{ printedAt }}</p>
      </div>
      <ol class="print-song-list">
        <template v-for="(item, index) in currentRepertoire.songs" :key="item.id">
          <li v-if="item.type !== 'pause'" :value="songNumber(index)">
            <span class="print-song-title">{{ item.title }}</span>
            <span v-if="item.artist" class="print-song-artist"> — {{ item.artist }}</span>
          </li>
          <li v-else class="print-pause">
            <span class="print-pause-line">-----</span>
          </li>
        </template>
      </ol>
      <p v-if="currentRepertoire.songs.length === 0" class="empty-state">{{ $t('repertoires.noSongs') }}</p>
    </div>

    <div class="no-print">

    <div class="tabs">
      <button @click="activeTab = 'songs'" :class="{ active: activeTab === 'songs' }" class="tab-button">
        <i class="fa-solid fa-music"></i> {{ $t('repertoire.tabSongs') }}
      </button>
      <button @click="activeTab = 'repertoires'" :class="{ active: activeTab === 'repertoires' }" class="tab-button">
        <i class="fa-solid fa-list-ol"></i> {{ $t('repertoire.tabRepertoires') }}
      </button>
    </div>

    <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Songs Tab -->
    <div v-if="activeTab === 'songs'" class="content">
      <section class="expenses-section">
        <div class="section-header">
          <div class="section-actions">
            <input type="text" v-model="songFilter" :placeholder="$t('songs.filterPlaceholder')" class="search-input" />
            <button @click="openImport" class="btn-secondary">
              <i class="fa-solid fa-file-import"></i> {{ $t('songs.import') }}
            </button>
            <button @click="openCreateSong" class="btn-primary">+ {{ $t('songs.addSong') }}</button>
            <button @click="loadData" :disabled="loading" class="btn-secondary">
              <i v-if="!loading" class="fa-solid fa-arrows-rotate"></i> {{ loading ? $t('actions.loading') : $t('actions.refresh') }}
            </button>
          </div>
        </div>

        <div v-if="loading && songs.length === 0" class="loading">
          <i class="fa-solid fa-spinner fa-spin"></i> {{ $t('actions.loading') }}
        </div>
        <div v-else-if="filteredSongs.length === 0" class="empty-state">
          <p>{{ $t('songs.noSongs') }}</p>
        </div>

        <table v-else class="expenses-table">
          <thead>
            <tr>
              <th>{{ $t('songs.songTitle') }}</th>
              <th>{{ $t('songs.artist') }}</th>
              <th>{{ $t('songs.notes') }}</th>
              <th class="actions"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="song in filteredSongs" :key="song.id">
              <td>{{ song.title }}</td>
              <td>{{ song.artist || '—' }}</td>
              <td>{{ song.notes || '—' }}</td>
              <td class="actions">
                <div class="actions-desktop">
                  <button @click="openEditSong(song)" class="btn-edit" :title="$t('actions.edit')">
                    <i class="fa-solid fa-pencil"></i>
                  </button>
                  <button @click="deleteSong(song)" class="btn-delete" :title="$t('actions.delete')">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <!-- Repertoires Tab -->
    <div v-if="activeTab === 'repertoires'" class="content">
      <!-- List of repertoires -->
      <section v-if="!currentRepertoire" class="expenses-section">
        <div class="section-header">
          <div class="section-actions">
            <button @click="openCreateRepertoire" class="btn-primary">+ {{ $t('repertoires.addRepertoire') }}</button>
            <button @click="loadData" :disabled="loading" class="btn-secondary">
              <i v-if="!loading" class="fa-solid fa-arrows-rotate"></i> {{ loading ? $t('actions.loading') : $t('actions.refresh') }}
            </button>
          </div>
        </div>

        <div v-if="repertoires.length === 0" class="empty-state">
          <p>{{ $t('repertoires.noRepertoires') }}</p>
        </div>

        <table v-else class="expenses-table">
          <thead>
            <tr>
              <th>{{ $t('repertoires.name') }}</th>
              <th>{{ $t('repertoires.date') }}</th>
              <th>{{ $t('repertoires.songCount') }}</th>
              <th class="actions"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="repertoire in repertoires" :key="repertoire.id">
              <td>
                <a href="#" @click.prevent="openRepertoire(repertoire.id)" class="link-strong">{{ repertoire.name }}</a>
              </td>
              <td>{{ formatDate(repertoire.date) }}</td>
              <td>{{ repertoire.songCount }}</td>
              <td class="actions">
                <div class="actions-desktop">
                  <button @click="openRepertoire(repertoire.id)" class="btn-edit" :title="$t('repertoires.open')">
                    <i class="fa-solid fa-folder-open"></i>
                  </button>
                  <button @click="openEditRepertoire(repertoire)" class="btn-edit" :title="$t('actions.edit')">
                    <i class="fa-solid fa-pencil"></i>
                  </button>
                  <button @click="deleteRepertoire(repertoire)" class="btn-delete" :title="$t('actions.delete')">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Repertoire builder -->
      <section v-else class="expenses-section builder">
        <div class="section-header builder-header">
          <div class="builder-title">
            <button @click="closeRepertoire" class="btn-secondary" :title="$t('repertoires.back')">
              <i class="fa-solid fa-arrow-left"></i>
            </button>
            <div>
              <h2>{{ currentRepertoire.name }}</h2>
              <p class="builder-subtitle">{{ formatDate(currentRepertoire.date) }}</p>
            </div>
          </div>
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
              <div class="print-control">
                <span>{{ $t('repertoires.printFontSize') }}</span>
                <div class="font-stepper">
                  <button type="button" class="btn-step" :disabled="!canDecreasePrintFont" @click="decreasePrintFont" title="Diminuir fonte">A-</button>
                  <span class="font-size-value">{{ printFontSize }}pt</span>
                  <button type="button" class="btn-step" :disabled="!canIncreasePrintFont" @click="increasePrintFont" title="Aumentar fonte">A+</button>
                </div>
              </div>
            </div>
            <button @click="openEditRepertoire(currentRepertoire)" class="btn-secondary" :title="$t('actions.edit')">
              <i class="fa-solid fa-pencil"></i>
            </button>
            <button @click="printRepertoire" class="btn-primary" :title="$t('app.print')">
              <i class="fa-solid fa-print"></i> {{ $t('app.print') }}
            </button>
          </div>
        </div>

        <div class="builder-columns">
          <!-- Current repertoire songs (ordered, reorderable) -->
          <div class="builder-panel">
            <div class="panel-head">
              <h3>{{ $t('repertoires.songsInList') }} ({{ currentRepertoire.songs.length }})</h3>
              <button @click="addPause" class="btn-secondary btn-sm" :title="$t('repertoires.addPauseHint')">
                <i class="fa-solid fa-grip-lines"></i> {{ $t('repertoires.addPause') }}
              </button>
            </div>
            <p class="hint">{{ $t('repertoires.reorderHint') }}</p>
            <ol v-if="currentRepertoire.songs.length > 0" class="song-order-list">
              <li
                v-for="(song, index) in currentRepertoire.songs"
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
                  <span class="pause-label"><i class="fa-solid fa-grip-lines"></i> {{ $t('repertoires.pause') }}</span>
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
                  <button @click="moveSong(index, 1)" :disabled="index === currentRepertoire.songs.length - 1" class="btn-icon" :title="$t('repertoires.moveDown')">
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
    </div>

    <!-- Song modal -->
    <Modal v-model="isSongModalOpen" :title="editingSong ? $t('songs.editSong') : $t('songs.addSong')">
      <form @submit.prevent="saveSong" class="form">
        <div class="form-group">
          <label>{{ $t('songs.songTitle') }} *</label>
          <input type="text" v-model="songForm.title" required autofocus />
        </div>
        <div class="form-group">
          <label>{{ $t('songs.artist') }}</label>
          <input type="text" v-model="songForm.artist" />
        </div>
        <div class="form-group">
          <label>{{ $t('songs.notes') }}</label>
          <textarea v-model="songForm.notes" rows="3"></textarea>
        </div>
        <div class="form-actions">
          <button type="button" @click="isSongModalOpen = false" class="btn-secondary">{{ $t('actions.cancel') }}</button>
          <button type="submit" :disabled="savingSong" class="btn-primary">
            {{ savingSong ? $t('actions.loading') : $t('actions.save') }}
          </button>
        </div>
      </form>
    </Modal>

    <!-- Import songs modal -->
    <Modal v-model="isImportModalOpen" :title="$t('songs.import')">
      <form @submit.prevent="submitImport" class="form">
        <p class="import-hint">{{ $t('songs.importHint') }}</p>
        <div class="form-group">
          <textarea
            v-model="importText"
            rows="12"
            class="import-textarea"
            :placeholder="$t('songs.importPlaceholder')"
            autofocus
          ></textarea>
        </div>
        <p v-if="importResult" class="import-result">
          {{ $t('songs.importResult', { created: importResult.created, skipped: importResult.skipped }) }}
        </p>
        <div class="form-actions">
          <button type="button" @click="isImportModalOpen = false" class="btn-secondary">{{ $t('actions.cancel') }}</button>
          <button type="submit" :disabled="importing" class="btn-primary">
            {{ importing ? $t('actions.loading') : $t('songs.import') }}
          </button>
        </div>
      </form>
    </Modal>

    <!-- Repertoire modal -->
    <Modal v-model="isRepertoireModalOpen" :title="editingRepertoire ? $t('repertoires.editRepertoire') : $t('repertoires.addRepertoire')">
      <form @submit.prevent="saveRepertoire" class="form">
        <div class="form-group">
          <label>{{ $t('repertoires.name') }} *</label>
          <input type="text" v-model="repertoireForm.name" required autofocus />
        </div>
        <div class="form-group">
          <label>{{ $t('repertoires.date') }}</label>
          <input type="date" v-model="repertoireForm.date" />
        </div>
        <div class="form-actions">
          <button type="button" @click="isRepertoireModalOpen = false" class="btn-secondary">{{ $t('actions.cancel') }}</button>
          <button type="submit" :disabled="savingRepertoire" class="btn-primary">
            {{ savingRepertoire ? $t('actions.loading') : $t('actions.save') }}
          </button>
        </div>
      </form>
    </Modal>

    </div>
  </div>
</template>

<style scoped>
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
.link-strong {
  font-weight: 600;
  color: var(--primary-color, #2563eb);
  text-decoration: none;
}
.link-strong:hover {
  text-decoration: underline;
}
.builder-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}
.builder-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.builder-title h2 {
  margin: 0;
}
.builder-subtitle {
  margin: 2px 0 0;
  font-size: 0.85rem;
  opacity: 0.7;
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
.pause-label {
  flex: 1;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.8rem;
  opacity: 0.6;
  display: flex;
  align-items: center;
  gap: 8px;
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
.form-group input,
.form-group textarea {
  padding: 8px 12px;
  border: 1px solid var(--border-color, #ccc);
  border-radius: 6px;
  font-size: 0.95rem;
  font-family: inherit;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}
.import-hint {
  font-size: 0.85rem;
  opacity: 0.7;
  margin: 0 0 12px;
}
.import-textarea {
  width: 100%;
  font-family: inherit;
  resize: vertical;
}
.import-result {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 4px 0 8px;
}
</style>
