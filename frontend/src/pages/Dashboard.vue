<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import { useBand } from '../composables/useBand'
import AppHeader from '../components/AppHeader.vue'
import BandLogoModal from '../components/BandLogoModal.vue'
import { formatDate as formatLocalDate, todayISO } from '../utils/date'
import { eventName } from '../utils/events'

const { t, locale } = useI18n()
const router = useRouter()
const { logout, getAuthHeader, member, getCurrentUser } = useAuth()
const { band, logoUrl } = useBand()
const isLogoModalOpen = ref(false)
const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

const health = ref('loading...')
const members = ref([])
const songs = ref([])
const upcomingEvents = ref([])
const expenses = ref([])
const logs = ref([])
const loading = ref(false)
const error = ref('')

const activeMembers = computed(() => members.value.filter(m => m.active))

const unpaidCount = computed(() => expenses.value.filter(e => !e.paid).length)

// Upcoming events come from the API in chronological order
const nextEvent = computed(() => upcomingEvents.value[0] || null)
const eventsThisMonth = computed(() =>
  upcomingEvents.value.filter(e => e.date.startsWith(todayISO().slice(0, 7))).length,
)

const lastSong = computed(() =>
  songs.value.reduce((latest, s) => (!latest || s.createdAt > latest.createdAt ? s : latest), null),
)

const lastExpense = computed(() => {
  const entryDate = (e) => e.date || (e.createdAt ? e.createdAt.slice(0, 10) : '')
  return expenses.value.reduce(
    (latest, e) => (!latest || entryDate(e) >= entryDate(latest) ? e : latest),
    null,
  )
})

async function loadData() {
  loading.value = true
  error.value = ''

  try {
    const authHeader = getAuthHeader()
    const responses = await Promise.all([
      fetch(`${apiBaseUrl}/api/health`, { headers: authHeader }),
      fetch(`${apiBaseUrl}/api/members`, { headers: authHeader }),
      fetch(`${apiBaseUrl}/api/songs`, { headers: authHeader }),
      fetch(`${apiBaseUrl}/api/events?from=${todayISO()}`, { headers: authHeader }),
      fetch(`${apiBaseUrl}/api/expenses`, { headers: authHeader }),
      fetch(`${apiBaseUrl}/api/logs?limit=5`, { headers: authHeader }),
    ])

    if (responses.some((response) => response.status === 401)) {
      await logout()
      await router.push({ path: '/login', query: { reason: 'expired' } })
      return
    }

    const [healthResponse, ...dataResponses] = responses
    if (!healthResponse.ok) {
      throw new Error(t('expenses.loadingError'))
    }

    // A failing section shouldn't take the whole summary down
    const readData = async (response) => (response.ok ? (await response.json()).data || [] : [])
    health.value = (await healthResponse.json()).status
    ;[members.value, songs.value, upcomingEvents.value, expenses.value, logs.value] =
      await Promise.all(dataResponses.map(readData))
  } catch (exception) {
    health.value = 'erro'
    error.value = exception instanceof Error ? exception.message : t('errors.genericError')
  } finally {
    loading.value = false
  }
}

function formatDate(dateStr) {
  return formatLocalDate(dateStr, locale.value)
}

function formatEvent(event) {
  const when = [formatDate(event.date), event.time].filter(Boolean).join(' ')
  return `${eventName(event)} · ${when}`
}

onMounted(async () => {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    await router.push('/login')
    return
  }

  loadData()
})
</script>

<template>
  <div class="container">
    <AppHeader
      icon="fa-guitar"
      :title="band?.name || $t('app.title')"
      :logo="logoUrl"
      logo-editable
      @edit-logo="isLogoModalOpen = true"
    />
    <BandLogoModal v-model="isLogoModalOpen" />

    <div class="content">
      <div class="welcome">
        <h2 v-if="member">{{ $t('home.welcome', { name: member.name }) }}</h2>
        <p>{{ $t('home.subtitle') }}</p>
      </div>

      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <div class="stats">
        <div class="stat">
          <i class="fa-solid fa-users"></i>
          <span class="stat-value">{{ loading ? '…' : activeMembers.length }}</span>
          <span class="stat-label">{{ $t('home.activeMembers') }}</span>
        </div>
        <div class="stat">
          <i class="fa-solid fa-music"></i>
          <span class="stat-value">{{ loading ? '…' : songs.length }}</span>
          <span class="stat-label">{{ $t('home.songs') }}</span>
        </div>
        <div class="stat">
          <i class="fa-solid fa-calendar-days"></i>
          <span class="stat-value">{{ loading ? '…' : upcomingEvents.length }}</span>
          <span class="stat-label">{{ $t('home.upcomingEvents') }}</span>
        </div>
        <div class="stat">
          <i class="fa-solid fa-hourglass-half"></i>
          <span class="stat-value">{{ loading ? '…' : unpaidCount }}</span>
          <span class="stat-label">{{ $t('home.pendingEntries') }}</span>
        </div>
      </div>

      <div class="modules">
        <router-link to="/agenda" class="module-card">
          <div class="module-title">
            <i class="fa-solid fa-calendar-days"></i>
            <h2>{{ $t('agenda.title') }}</h2>
          </div>
          <p class="module-description">{{ $t('home.agendaDescription') }}</p>
          <dl class="module-facts">
            <div>
              <dt>{{ $t('home.nextEvent') }}</dt>
              <dd v-if="nextEvent">{{ formatEvent(nextEvent) }}</dd>
              <dd v-else>{{ $t('home.none') }}</dd>
            </div>
            <div>
              <dt>{{ $t('home.eventsThisMonth') }}</dt>
              <dd>{{ eventsThisMonth }}</dd>
            </div>
          </dl>
          <span class="module-link">{{ $t('home.open') }} <i class="fa-solid fa-arrow-right"></i></span>
        </router-link>

        <router-link to="/musicas" class="module-card">
          <div class="module-title">
            <i class="fa-solid fa-music"></i>
            <h2>{{ $t('songs.title') }}</h2>
          </div>
          <p class="module-description">{{ $t('home.songsDescription') }}</p>
          <dl class="module-facts">
            <div>
              <dt>{{ $t('home.songs') }}</dt>
              <dd>{{ songs.length }}</dd>
            </div>
            <div>
              <dt>{{ $t('home.lastSong') }}</dt>
              <dd v-if="lastSong">{{ lastSong.title }}</dd>
              <dd v-else>{{ $t('home.none') }}</dd>
            </div>
          </dl>
          <span class="module-link">{{ $t('home.open') }} <i class="fa-solid fa-arrow-right"></i></span>
        </router-link>

        <router-link to="/financeiro" class="module-card">
          <div class="module-title">
            <i class="fa-solid fa-coins"></i>
            <h2>{{ $t('finance.title') }}</h2>
          </div>
          <p class="module-description">{{ $t('home.financeDescription') }}</p>
          <dl class="module-facts">
            <div>
              <dt>{{ $t('home.entries') }}</dt>
              <dd>{{ expenses.length }}</dd>
            </div>
            <div>
              <dt>{{ $t('home.lastEntry') }}</dt>
              <dd v-if="lastExpense">{{ lastExpense.description }} · {{ formatDate(lastExpense.date || lastExpense.createdAt) }}</dd>
              <dd v-else>{{ $t('home.none') }}</dd>
            </div>
          </dl>
          <span class="module-link">{{ $t('home.open') }} <i class="fa-solid fa-arrow-right"></i></span>
        </router-link>
      </div>

      <div class="panels">
        <section class="expenses-section">
          <div class="panel-header">
            <h2><i class="fa-solid fa-users"></i> {{ $t('home.members') }}</h2>
            <router-link to="/integrantes" class="panel-link">{{ $t('home.viewAll') }}</router-link>
          </div>
          <p v-if="activeMembers.length === 0" class="empty-state">{{ $t('home.noMembers') }}</p>
          <ul v-else class="member-list">
            <li v-for="m in activeMembers" :key="m.id">{{ m.name }}</li>
          </ul>
        </section>

        <section class="expenses-section">
          <div class="panel-header">
            <h2><i class="fa-solid fa-clock-rotate-left"></i> {{ $t('home.recentActivity') }}</h2>
            <router-link to="/registros" class="panel-link">{{ $t('home.viewAll') }}</router-link>
          </div>
          <p v-if="logs.length === 0" class="empty-state">{{ $t('home.noActivity') }}</p>
          <ul v-else class="activity-list">
            <li v-for="log in logs" :key="log.id">
              <span class="activity-what">{{ log.action }} · {{ log.resource }}</span>
              <span class="activity-meta">{{ log.userName || '-' }} · {{ formatDate(log.createdAt) }}</span>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <footer class="app-footer">
      <span class="badge" :class="{ online: health === 'ok', offline: health !== 'ok' }">
        <i class="fa-solid fa-circle"></i> {{ health === 'ok' ? 'Online' : 'Offline' }}
      </span>
    </footer>
  </div>
</template>

<style scoped>
.welcome h2 {
  margin: 0;
  color: var(--text-h);
}
.welcome p {
  margin: 4px 0 0;
  color: var(--text-light);
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 8px;
  background: var(--bg-white);
  border-radius: 12px;
  box-shadow: var(--shadow);
  text-align: center;
}
.stat i {
  color: var(--accent);
}
.stat-value {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--text-h);
  line-height: 1.1;
}
.stat-label {
  font-size: 0.85rem;
  color: var(--text-light);
}
.modules,
.panels {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
.modules {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}
.module-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  background: var(--bg-white);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
  color: var(--text);
  text-decoration: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.module-card:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-lg);
}
.module-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--accent);
}
.module-title h2 {
  margin: 0;
  color: var(--text-h);
}
.module-description {
  margin: 0;
  color: var(--text-light);
  text-align: left;
}
.module-facts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 4px 0 0;
}
.module-facts div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.module-facts dt {
  flex-shrink: 0;
  color: var(--text-light);
  text-align: left;
  white-space: nowrap;
}
.module-facts dd {
  margin: 0;
  font-weight: 600;
  text-align: right;
  overflow-wrap: anywhere;
}
.module-link {
  align-self: flex-start;
  margin-top: auto;
  padding-top: 8px;
  font-weight: 600;
  color: var(--accent);
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}
.panel-header h2 {
  margin: 0;
  font-size: 1.1rem;
  text-align: left;
}
.panel-link {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--accent);
  text-decoration: none;
  white-space: nowrap;
}
.panel-link:hover {
  text-decoration: underline;
}
.member-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.member-list li {
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--accent-light);
  color: var(--accent);
  font-size: 0.9rem;
}
.activity-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}
.activity-list li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}
.activity-list li:last-child {
  border-bottom: none;
}
.activity-meta {
  color: var(--text-light);
  font-size: 0.85rem;
  white-space: nowrap;
}
@media (max-width: 768px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .modules,
  .panels {
    grid-template-columns: 1fr;
  }
}
</style>
