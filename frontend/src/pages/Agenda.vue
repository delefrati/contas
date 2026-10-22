<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import { useBand } from '../composables/useBand'
import AppHeader from '../components/AppHeader.vue'
import EventFormModal from '../components/EventFormModal.vue'
import EventTypesModal from '../components/EventTypesModal.vue'
import { formatDate as formatLocalDate, localeTag, monthGrid, parseDate, todayISO } from '../utils/date'
import { eventName, typeStyle } from '../utils/events'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { logout, getAuthHeader, getCurrentUser } = useAuth()
const { band } = useBand()
const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

const events = ref([])
const types = ref([])
const loading = ref(false)
const error = ref('')
const successMessage = ref('')

const isEventModalOpen = ref(false)
const isTypesModalOpen = ref(false)
const newEventDate = ref('')

// Types unchecked in the filter, remembered per browser. Storing the hidden ones
// means newly created types show up without touching the filter.
const HIDDEN_TYPES_KEY = 'agenda_hidden_types'

function readHiddenTypes() {
  try {
    const ids = JSON.parse(localStorage.getItem(HIDDEN_TYPES_KEY) || '[]')
    return Array.isArray(ids) ? ids.filter(Number.isInteger) : []
  } catch {
    return []
  }
}

const hiddenTypeIds = ref(readHiddenTypes())

watch(hiddenTypeIds, (ids) => {
  try {
    localStorage.setItem(HIDDEN_TYPES_KEY, JSON.stringify(ids))
  } catch {
    // Not persisting the filter is fine
  }
})

function isTypeShown(type) {
  return !hiddenTypeIds.value.includes(type.id)
}

function toggleType(type) {
  hiddenTypeIds.value = isTypeShown(type)
    ? [...hiddenTypeIds.value, type.id]
    : hiddenTypeIds.value.filter((id) => id !== type.id)
}

const isFiltered = computed(() => types.value.some((type) => !isTypeShown(type)))

// Events of deleted types have no filter chip, so they always show
const visibleEvents = computed(() =>
  events.value.filter((event) => !hiddenTypeIds.value.includes(event.typeId)),
)

const today = todayISO()

// The month shown is kept in the URL (?mes=YYYY-MM) so going back from an event returns to it
const viewMonth = computed(() => {
  const match = /^(\d{4})-(\d{2})$/.exec(route.query.mes || '')
  if (match) return { year: Number(match[1]), month: Number(match[2]) - 1 }
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() }
})

const weeks = computed(() => monthGrid(viewMonth.value.year, viewMonth.value.month))

const monthPrefix = computed(() =>
  `${viewMonth.value.year}-${String(viewMonth.value.month + 1).padStart(2, '0')}`,
)

const monthLabel = computed(() =>
  new Date(viewMonth.value.year, viewMonth.value.month, 1)
    .toLocaleDateString(localeTag(locale.value), { month: 'long', year: 'numeric' }),
)

// 2026-01-04 is a Sunday
const weekdays = computed(() =>
  Array.from({ length: 7 }, (_, i) =>
    new Date(2026, 0, 4 + i).toLocaleDateString(localeTag(locale.value), { weekday: 'short' }),
  ),
)

const eventsByDate = computed(() => {
  const map = {}
  for (const event of visibleEvents.value) {
    ;(map[event.date] ||= []).push(event)
  }
  return map
})

const monthEvents = computed(() => visibleEvents.value.filter((e) => e.date.startsWith(monthPrefix.value)))

function goToMonth(delta) {
  const date = new Date(viewMonth.value.year, viewMonth.value.month + delta, 1)
  const mes = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  router.replace({ query: { ...route.query, mes } })
}

function goToToday() {
  const { mes, ...query } = route.query
  router.replace({ query })
}

async function loadEvents() {
  loading.value = true
  error.value = ''
  try {
    const from = weeks.value[0][0]
    const to = weeks.value[weeks.value.length - 1][6]
    const authHeader = getAuthHeader()
    const [eventsResponse, typesResponse] = await Promise.all([
      fetch(`${apiBaseUrl}/api/events?from=${from}&to=${to}`, { headers: authHeader }),
      fetch(`${apiBaseUrl}/api/event-types`, { headers: authHeader }),
    ])

    if (eventsResponse.status === 401 || typesResponse.status === 401) {
      await logout()
      await router.push({ path: '/login', query: { reason: 'expired' } })
      return
    }
    if (!eventsResponse.ok || !typesResponse.ok) throw new Error(t('agenda.loadingError'))

    events.value = (await eventsResponse.json()).data || []
    types.value = (await typesResponse.json()).data || []
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : t('errors.genericError')
  } finally {
    loading.value = false
  }
}

function openCreateEvent(date = '') {
  newEventDate.value = date || (monthPrefix.value === today.slice(0, 7) ? today : `${monthPrefix.value}-01`)
  isEventModalOpen.value = true
}

// Go straight to the new event so its setlist can be built
function onEventSaved(event) {
  router.push(`/agenda/${event.id}`)
}

function showSuccess(message) {
  successMessage.value = '✓ ' + message
  setTimeout(() => { successMessage.value = '' }, 3000)
}

// Plain text for WhatsApp: *bold* dates, one line per event
function buildAgendaText() {
  const tag = localeTag(locale.value)
  const heading = [t('agenda.title'), band.value?.name].filter(Boolean).join(' · ')
  const monthName = monthLabel.value.charAt(0).toUpperCase() + monthLabel.value.slice(1)
  const lines = [`*${heading} — ${monthName}*`]
  if (isFiltered.value) {
    lines.push(types.value.filter(isTypeShown).map((type) => type.name).join(', '))
  }
  lines.push('')

  for (const event of monthEvents.value) {
    const date = parseDate(event.date)
    const day = date.toLocaleDateString(tag, { day: '2-digit', month: '2-digit' })
    const when = [formatWeekday(event.date), day, event.time].filter(Boolean).join(' ')
    const place = event.location ? ` (${event.location})` : ''
    lines.push(`*${when}* — ${eventName(event)}${place}`)
  }

  return lines.join('\n')
}

async function shareAgenda() {
  const text = buildAgendaText()
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      throw new Error('clipboard unavailable')
    }
    showSuccess(t('agenda.shareSuccess'))
  } catch {
    window.prompt(t('repertoires.shareFallbackHint'), text)
  }
}

function dayNumber(date) {
  return Number(date.slice(8))
}

function formatDate(date) {
  return formatLocalDate(date, locale.value)
}

function formatWeekday(date) {
  return parseDate(date).toLocaleDateString(localeTag(locale.value), { weekday: 'short' })
}

watch(monthPrefix, loadEvents)

onMounted(async () => {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    await router.push('/login')
    return
  }

  loadEvents()
})
</script>

<template>
  <div class="container">
    <AppHeader icon="fa-calendar-days" :title="$t('agenda.title')" />

    <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div class="content">
      <section class="expenses-section">
        <div class="calendar-toolbar">
          <div class="month-nav">
            <button @click="goToMonth(-1)" class="btn-secondary" :title="$t('agenda.previousMonth')" :aria-label="$t('agenda.previousMonth')">
              <i class="fa-solid fa-chevron-left"></i>
            </button>
            <h2 class="month-label">{{ monthLabel }}</h2>
            <button @click="goToMonth(1)" class="btn-secondary" :title="$t('agenda.nextMonth')" :aria-label="$t('agenda.nextMonth')">
              <i class="fa-solid fa-chevron-right"></i>
            </button>
            <button @click="goToToday" class="btn-secondary">{{ $t('agenda.today') }}</button>
            <span v-if="loading" class="saving-indicator"><i class="fa-solid fa-spinner fa-spin"></i></span>
          </div>
          <div class="toolbar-actions">
            <button @click="shareAgenda" :disabled="monthEvents.length === 0" class="btn-secondary" :title="$t('agenda.shareHint')">
              <i class="fa-solid fa-share-nodes"></i> {{ $t('agenda.share') }}
            </button>
            <button @click="isTypesModalOpen = true" class="btn-secondary" :title="$t('agenda.typesTitle')">
              <i class="fa-solid fa-tags"></i> {{ $t('agenda.manageTypes') }}
            </button>
            <button @click="openCreateEvent()" class="btn-primary">+ {{ $t('agenda.newEvent') }}</button>
          </div>
        </div>

        <div v-if="types.length > 1" class="type-filter" role="group" :aria-label="$t('agenda.typeFilter')">
          <span class="type-filter-label">{{ $t('agenda.typeFilter') }}</span>
          <button
            v-for="type in types"
            :key="type.id"
            type="button"
            class="type-filter-chip"
            :class="{ active: isTypeShown(type) }"
            :style="typeStyle(type)"
            :aria-pressed="isTypeShown(type)"
            @click="toggleType(type)"
          >
            <span class="type-dot"></span> {{ type.name }}
          </button>
        </div>

        <div class="calendar" role="grid">
          <div class="calendar-row calendar-weekdays" role="row">
            <div v-for="weekday in weekdays" :key="weekday" class="weekday" role="columnheader">{{ weekday }}</div>
          </div>
          <div v-for="week in weeks" :key="week[0]" class="calendar-row" role="row">
            <div
              v-for="date in week"
              :key="date"
              class="day"
              :class="{
                'is-outside': !date.startsWith(monthPrefix),
                'is-today': date === today,
                'is-past': date < today,
              }"
              role="gridcell"
              @click="openCreateEvent(date)"
            >
              <button
                type="button"
                class="day-number"
                :title="$t('agenda.addOnDay', { date: formatDate(date) })"
                :aria-label="$t('agenda.addOnDay', { date: formatDate(date) })"
                @click.stop="openCreateEvent(date)"
              >{{ dayNumber(date) }}</button>
              <router-link
                v-for="event in eventsByDate[date] || []"
                :key="event.id"
                :to="`/agenda/${event.id}`"
                class="event-chip"
                :style="typeStyle(event.type)"
                :title="[event.time, eventName(event)].filter(Boolean).join(' ')"
                @click.stop
              >
                <span v-if="event.time" class="event-chip-time">{{ event.time }}</span>
                <span class="event-chip-name">{{ eventName(event) }}</span>
              </router-link>
            </div>
          </div>
        </div>
      </section>

      <section class="expenses-section">
        <h2 class="list-title">{{ $t('agenda.monthEvents') }}</h2>
        <p v-if="!loading && monthEvents.length === 0" class="empty-state">{{ $t('agenda.noEvents') }}</p>
        <ul v-else class="event-list">
          <li v-for="event in monthEvents" :key="event.id">
            <router-link :to="`/agenda/${event.id}`" class="event-row" :class="{ 'is-past': event.date < today }">
              <span class="event-date">
                <span class="event-date-day">{{ dayNumber(event.date) }}</span>
                <span class="event-date-weekday">{{ formatWeekday(event.date) }}</span>
              </span>
              <span class="event-info">
                <span class="event-name">
                  <span class="type-tag" :style="typeStyle(event.type)">{{ event.type.name }}</span>
                  {{ eventName(event) }}
                </span>
                <span class="event-meta">
                  <span v-if="event.time"><i class="fa-regular fa-clock"></i> {{ event.time }}</span>
                  <span v-if="event.location"><i class="fa-solid fa-location-dot"></i> {{ event.location }}</span>
                  <span><i class="fa-solid fa-list-ol"></i> {{ $t('agenda.songCount', event.songCount) }}</span>
                </span>
              </span>
              <i class="fa-solid fa-chevron-right event-arrow"></i>
            </router-link>
          </li>
        </ul>
      </section>
    </div>

    <EventFormModal v-model="isEventModalOpen" :default-date="newEventDate" :types="types" @saved="onEventSaved" />
    <EventTypesModal v-model="isTypesModalOpen" :types="types" @changed="loadEvents" />
  </div>
</template>

<style scoped>
.calendar-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.toolbar-actions {
  display: flex;
  gap: 8px;
}
.type-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.type-filter-label {
  font-size: 0.85rem;
  color: var(--text-light);
}
.type-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--text-light);
  font-size: 0.85rem;
  cursor: pointer;
}
.type-filter-chip .type-dot {
  background: transparent;
  box-shadow: inset 0 0 0 2px var(--type-color);
}
.type-filter-chip.active {
  border-color: var(--type-color);
  background: color-mix(in srgb, var(--type-color) 16%, transparent);
  color: var(--text-h);
  font-weight: 600;
}
.type-filter-chip.active .type-dot {
  background: var(--type-color);
}
.toolbar-actions {
  flex-wrap: wrap;
}
.month-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}
.month-label {
  margin: 0;
  min-width: 11ch;
  text-align: center;
  font-size: 1.2rem;
}
.month-label::first-letter {
  text-transform: uppercase;
}
.saving-indicator {
  opacity: 0.6;
}
.calendar {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
.calendar-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}
.calendar-row + .calendar-row {
  border-top: 1px solid var(--border);
}
.weekday {
  padding: 6px 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-light);
  text-align: center;
}
.day {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 96px;
  padding: 4px;
  cursor: pointer;
  min-width: 0;
}
.day + .day {
  border-left: 1px solid var(--border);
}
.day:hover {
  background: var(--accent-light);
}
.day.is-outside {
  background: rgba(127, 127, 127, 0.06);
}
.day.is-outside .day-number {
  opacity: 0.45;
}
.day-number {
  align-self: flex-end;
  min-width: 26px;
  height: 26px;
  padding: 0 4px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text-h);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}
.day.is-today .day-number {
  background: var(--accent);
  color: var(--bg-white);
}
.event-chip {
  display: flex;
  background: color-mix(in srgb, var(--type-color) 16%, transparent);
  color: var(--text-h);
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  line-height: 1.4;
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  border-left: 3px solid var(--type-color);
}
.event-chip:hover {
  filter: brightness(0.95);
}
.day.is-past .event-chip {
  opacity: 0.65;
}
.event-chip-time {
  font-weight: 600;
}
.event-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.list-title {
  margin: 0 0 12px;
  font-size: 1.1rem;
  text-align: left;
}
.event-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.event-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  text-decoration: none;
}
.event-list li:last-child .event-row {
  border-bottom: none;
}
.event-row:hover {
  background: var(--accent-light);
}
.event-row.is-past {
  opacity: 0.6;
}
.event-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 44px;
}
.event-date-day {
  font-size: 1.4rem;
  font-weight: 700;
  line-height: 1;
  color: var(--text-h);
}
.event-date-weekday {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-light);
}
.event-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  text-align: left;
}
.event-name {
  font-weight: 600;
  color: var(--text-h);
  overflow-wrap: anywhere;
}
.event-name .type-tag {
  margin-right: 6px;
}
.event-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 0.85rem;
  color: var(--text-light);
}
.event-arrow {
  color: var(--text-light);
}
@media (max-width: 600px) {
  .day {
    min-height: 56px;
    padding: 2px;
    align-items: center;
  }
  .day-number {
    align-self: center;
  }
  /* Too narrow for names: show a colored bar per event, the list below has the details */
  .event-chip {
    width: 100%;
    height: 6px;
    padding: 0;
    border-left: none;
  }
  .event-chip {
    background: var(--type-color);
  }
  .event-chip-time,
  .event-chip-name {
    display: none;
  }
  .month-label {
    font-size: 1rem;
  }
}
</style>
