<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import { useBand } from '../composables/useBand'
import { useOfflineCopy } from '../composables/useOfflineCopy'
import AppHeader from '../components/AppHeader.vue'
import OfflineBar from '../components/OfflineBar.vue'
import EventFormModal from '../components/EventFormModal.vue'
import EventTypesModal from '../components/EventTypesModal.vue'
import CalendarFeedModal from '../components/CalendarFeedModal.vue'
import EventRow from '../components/EventRow.vue'
import { formatDate as formatLocalDate, localeTag, monthGrid, parseDate, todayISO } from '../utils/date'
import { eventName, eventTime, groupByMonth, LIST_PERIODS, listEvents, typeStyle } from '../utils/events'
import { copyInfo, readSnapshot } from '../offline/snapshot'
import { readStagePosition } from '../offline/stage'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { getAuthHeader, handleUnauthorized, scheduleCopySync } = useAuth()
const { band } = useBand()
const { showingCopy, load } = useOfflineCopy()
const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

const events = ref([])
const types = ref([])
const loading = ref(false)
const error = ref('')
const successMessage = ref('')

const isEventModalOpen = ref(false)
const isTypesModalOpen = ref(false)
const isCalendarModalOpen = ref(false)
const newEventDate = ref('')

// Left behind only when the phone killed the app in the middle of a show
const stageToResume = readStagePosition()

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

// Calendar or list, in the URL (?ver=lista) so going back from an event returns to it, and
// remembered per browser so whoever prefers the list never has to open the calendar
const VIEW_KEY = 'agenda_view'
const VIEW_QUERY = { calendar: 'calendario', list: 'lista' }

function readStoredView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'calendar'
  } catch {
    return 'calendar'
  }
}

const view = computed(() => {
  const fromUrl = Object.keys(VIEW_QUERY).find((key) => VIEW_QUERY[key] === route.query.ver)
  return fromUrl || readStoredView()
})

function setView(next) {
  try {
    localStorage.setItem(VIEW_KEY, next)
  } catch {
    // Not remembering the view is fine
  }
  router.replace({ query: { ...route.query, ver: VIEW_QUERY[next] } })
}

// The list's period and search are in the URL too (?periodo=passados&busca=...)
const PERIOD_QUERY = { upcoming: 'proximos', past: 'passados', all: 'todos' }

const period = computed(() =>
  LIST_PERIODS.find((key) => PERIOD_QUERY[key] === route.query.periodo) || 'upcoming',
)

function setPeriod(next) {
  const { periodo, ...query } = route.query
  router.replace({ query: next === 'upcoming' ? query : { ...query, periodo: PERIOD_QUERY[next] } })
}

const search = ref(typeof route.query.busca === 'string' ? route.query.busca : '')

watch(search, (value) => {
  const { busca, ...query } = route.query
  router.replace({ query: value.trim() ? { ...query, busca: value } : query })
})

const listed = computed(() =>
  listEvents(visibleEvents.value, { period: period.value, search: search.value, today }),
)
const upcomingMonths = computed(() => groupByMonth(listed.value.upcoming))
const pastMonths = computed(() => groupByMonth(listed.value.past))
const listParts = computed(() => [
  { key: 'upcoming', title: t('agenda.periodUpcoming'), count: listed.value.upcoming.length, months: upcomingMonths.value },
  { key: 'past', title: t('agenda.periodPast'), count: listed.value.past.length, months: pastMonths.value },
].filter((part) => part.count > 0))
const listIsEmpty = computed(() => listed.value.upcoming.length + listed.value.past.length === 0)

function monthName(month) {
  const [year, number] = month.split('-').map(Number)
  return new Date(year, number - 1, 1).toLocaleDateString(localeTag(locale.value), { month: 'long', year: 'numeric' })
}

// Offline, the list only has what was downloaded: from last month to a year ahead
const listWindow = computed(() => {
  const window = showingCopy.value && copyInfo.value?.window
  return window ? { from: formatDate(window.from), to: formatDate(window.to) } : null
})

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

// The months the downloaded copy doesn't reach are simply unknown, not empty
const monthNotDownloaded = computed(() => {
  const window = showingCopy.value && copyInfo.value?.window
  return Boolean(window) &&
    (monthPrefix.value < window.from.slice(0, 7) || monthPrefix.value > window.to.slice(0, 7))
})

// The calendar loads the weeks shown, the list every event of the band
async function loadEvents() {
  loading.value = true
  error.value = ''
  const listing = view.value === 'list'
  const from = weeks.value[0][0]
  const to = weeks.value[weeks.value.length - 1][6]
  try {
    const outcome = await load({
      paths: [listing ? '/api/events' : `/api/events?from=${from}&to=${to}`, '/api/event-types'],
      paint(snapshot) {
        events.value = listing
          ? snapshot.events
          : snapshot.events.filter((event) => event.date >= from && event.date <= to)
        types.value = snapshot.eventTypes
      },
      apply([liveEvents, liveTypes]) {
        events.value = liveEvents || []
        types.value = liveTypes || []
      },
    })
    if (outcome === 'superseded') return
    if (outcome === 'copy') {
      isEventModalOpen.value = false
      isTypesModalOpen.value = false
      isCalendarModalOpen.value = false
    }
    if (outcome === 'offline' || outcome === 'failed') error.value = t('agenda.loadingError')
    loading.value = false
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : t('errors.genericError')
    loading.value = false
  }
}

function openCreateEvent(date = '') {
  if (showingCopy.value) return
  newEventDate.value = date || (monthPrefix.value === today.slice(0, 7) ? today : `${monthPrefix.value}-01`)
  isEventModalOpen.value = true
}

// Go straight to the new event so its setlist can be built
function onEventSaved(event) {
  scheduleCopySync()
  router.push(`/agenda/${event.id}`)
}

function showSuccess(message) {
  successMessage.value = '✓ ' + message
  setTimeout(() => { successMessage.value = '' }, 3000)
}

// Plain text for WhatsApp: a *bold* heading naming the filtered types, then one line per event
function shareHeading(subtitle) {
  const heading = [t('agenda.title'), band.value?.name].filter(Boolean).join(' · ')
  const lines = [`*${heading} — ${subtitle}*`]
  if (isFiltered.value) {
    lines.push(types.value.filter(isTypeShown).map((type) => type.name).join(', '))
  }
  lines.push('')
  return lines
}

function eventLine(event) {
  const day = parseDate(event.date).toLocaleDateString(localeTag(locale.value), { day: '2-digit', month: '2-digit' })
  const when = [formatWeekday(event.date), day, eventTime(event)].filter(Boolean).join(' ')
  const place = event.location ? ` (${event.location})` : ''
  return `*${when}* — ${eventName(event)}${place}`
}

function buildAgendaText() {
  const monthName = monthLabel.value.charAt(0).toUpperCase() + monthLabel.value.slice(1)
  return [...shareHeading(monthName), ...monthEvents.value.map(eventLine)].join('\n')
}

// A blank line between months, as in a WhatsApp group description
function buildUpcomingText(upcoming) {
  const lines = shareHeading(t('agenda.upcoming'))
  upcoming.forEach((event, index) => {
    if (index > 0 && event.date.slice(0, 7) !== upcoming[index - 1].date.slice(0, 7)) lines.push('')
    lines.push(eventLine(event))
  })
  return lines.join('\n')
}

async function copyText(text, message) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      throw new Error('clipboard unavailable')
    }
    showSuccess(message)
  } catch {
    window.prompt(t('repertoires.shareFallbackHint'), text)
  }
}

function shareAgenda() {
  return copyText(buildAgendaText(), t('agenda.shareSuccess'))
}

// Every event from today on, whatever month is shown
async function shareUpcoming() {
  error.value = ''
  try {
    let upcoming
    if (showingCopy.value) {
      const snapshot = await readSnapshot()
      upcoming = (snapshot?.events || []).filter((event) => event.date >= today)
    } else {
      const response = await fetch(`${apiBaseUrl}/api/events?from=${today}`, { headers: getAuthHeader() })
      if (response.status === 401) {
        await handleUnauthorized()
        await router.push({ path: '/login', query: { reason: 'expired' } })
        return
      }
      if (!response.ok) throw new Error(t('agenda.loadingError'))
      upcoming = (await response.json()).data || []
    }

    upcoming = upcoming.filter((event) => !hiddenTypeIds.value.includes(event.typeId))
    if (upcoming.length === 0) {
      error.value = t('agenda.noUpcoming')
      return
    }
    await copyText(buildUpcomingText(upcoming), t('agenda.shareSuccess'))
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : t('errors.genericError')
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

watch(monthPrefix, () => {
  if (view.value === 'calendar') loadEvents()
})
watch(view, loadEvents)

function onTypesChanged() {
  scheduleCopySync()
  loadEvents()
}

onMounted(loadEvents)
</script>

<template>
  <div class="container">
    <AppHeader icon="fa-calendar-days" :title="$t('agenda.title')" />

    <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <OfflineBar />
    <router-link
      v-if="stageToResume"
      :to="{ path: `/agenda/${stageToResume.eventId}`, query: { visualizar: '1' } }"
      class="btn-primary resume-stage"
    >
      <i class="fa-solid fa-mobile-screen"></i> {{ $t('offline.backToStage') }}
    </router-link>

    <div class="tabs" role="tablist">
      <button
        type="button"
        role="tab"
        class="tab-button"
        :class="{ active: view === 'calendar' }"
        :aria-selected="view === 'calendar'"
        @click="setView('calendar')"
      >
        <i class="fa-solid fa-calendar-days"></i> {{ $t('agenda.viewCalendar') }}
      </button>
      <button
        type="button"
        role="tab"
        class="tab-button"
        :class="{ active: view === 'list' }"
        :aria-selected="view === 'list'"
        @click="setView('list')"
      >
        <i class="fa-solid fa-list"></i> {{ $t('agenda.viewList') }}
      </button>
    </div>

    <div class="content">
      <section class="expenses-section">
        <div class="calendar-toolbar">
          <div v-if="view === 'list'" class="list-controls">
            <div class="period-filter" role="group" :aria-label="$t('agenda.periodFilter')">
              <button
                v-for="key in LIST_PERIODS"
                :key="key"
                type="button"
                class="type-filter-chip period-chip"
                :class="{ active: period === key }"
                :aria-pressed="period === key"
                @click="setPeriod(key)"
              >{{ $t(`agenda.period${key.charAt(0).toUpperCase()}${key.slice(1)}`) }}</button>
            </div>
            <input
              v-model="search"
              type="search"
              class="search-input"
              :placeholder="$t('agenda.search')"
              :aria-label="$t('agenda.search')"
            />
            <span v-if="loading" class="saving-indicator"><i class="fa-solid fa-spinner fa-spin"></i></span>
          </div>
          <div v-else class="month-nav">
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
            <button v-if="view === 'calendar'" @click="shareAgenda" :disabled="monthEvents.length === 0" class="btn-secondary" :title="$t('agenda.shareHint')">
              <i class="fa-solid fa-share-nodes"></i> {{ $t('agenda.share') }}
            </button>
            <button @click="shareUpcoming" class="btn-secondary" :title="$t('agenda.shareUpcomingHint')">
              <i class="fa-solid fa-list-ul"></i> {{ $t('agenda.shareUpcoming') }}
            </button>
            <button @click="isCalendarModalOpen = true" :disabled="showingCopy" class="btn-secondary" :title="$t('calendarFeed.buttonHint')">
              <i class="fa-solid fa-calendar-plus"></i> {{ $t('calendarFeed.button') }}
            </button>
            <button @click="isTypesModalOpen = true" :disabled="showingCopy" class="btn-secondary" :title="$t('agenda.typesTitle')">
              <i class="fa-solid fa-tags"></i> {{ $t('agenda.manageTypes') }}
            </button>
            <button @click="openCreateEvent()" :disabled="showingCopy" class="btn-primary">+ {{ $t('agenda.newEvent') }}</button>
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

        <div v-if="view === 'list'" class="agenda-list">
          <p v-if="listWindow" class="list-note">{{ $t('offline.listPartial', listWindow) }}</p>
          <p v-if="!loading && listIsEmpty" class="empty-state">{{ $t('agenda.listEmpty') }}</p>
          <div v-for="part in listParts" :key="part.key" class="list-part">
            <h2 class="list-title">{{ part.title }} <span class="list-count">({{ part.count }})</span></h2>
            <div v-for="group in part.months" :key="group.month" class="list-month">
              <h3 class="list-month-title">{{ monthName(group.month) }}</h3>
              <ul class="event-list">
                <li v-for="event in group.events" :key="event.id">
                  <EventRow :event="event" />
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div v-else class="calendar" role="grid">
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
                :title="[eventTime(event), eventName(event)].filter(Boolean).join(' ')"
                @click.stop
              >
                <span v-if="event.time" class="event-chip-time">{{ event.time }}</span>
                <span class="event-chip-name">{{ eventName(event) }}</span>
              </router-link>
            </div>
          </div>
        </div>
      </section>

      <section v-if="view === 'calendar'" class="expenses-section">
        <h2 class="list-title">{{ $t('agenda.monthEvents') }}</h2>
        <p v-if="!loading && monthEvents.length === 0" class="empty-state">
          {{ monthNotDownloaded ? $t('offline.monthNotDownloaded') : $t('agenda.noEvents') }}
        </p>
        <ul v-else class="event-list">
          <li v-for="event in monthEvents" :key="event.id">
            <EventRow :event="event" :past="event.date < today" />
          </li>
        </ul>
      </section>
    </div>

    <EventFormModal v-model="isEventModalOpen" :default-date="newEventDate" :types="types" @saved="onEventSaved" />
    <EventTypesModal v-model="isTypesModalOpen" :types="types" @changed="onTypesChanged" />
    <CalendarFeedModal v-model="isCalendarModalOpen" />
  </div>
</template>

<style scoped>
.resume-stage {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  text-decoration: none;
}
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
.event-list li:last-child :deep(.event-row) {
  border-bottom: none;
}
.list-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  flex: 1;
}
.period-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.period-chip {
  --type-color: var(--accent);
}
.list-controls .search-input {
  flex: 1;
  min-width: 180px;
  max-width: 320px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.95rem;
}
.list-note {
  margin: 0 0 12px;
  font-size: 0.85rem;
  color: var(--text-light);
}
.list-part + .list-part {
  margin-top: 24px;
}
.list-count {
  font-weight: 400;
  color: var(--text-light);
}
.list-month + .list-month {
  margin-top: 12px;
}
.list-month-title {
  margin: 0 0 4px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  text-align: left;
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
