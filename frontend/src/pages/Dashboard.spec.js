import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ref } from 'vue'
import Dashboard from './Dashboard.vue'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock useAuth
vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    logout: vi.fn(),
    getCurrentUser: vi.fn().mockResolvedValue({ memberId: 1, name: 'Test User' }),
    getAuthHeader: () => ({ Authorization: 'Bearer fake-token' }),
    member: ref({ id: 1, name: 'Test User' }),
    isLoggedIn: { value: true },
    token: { value: 'fake-token' },
  }),
}))

vi.mock('../composables/useBand', () => ({
  useBand: () => ({ band: ref({ name: 'Maverick' }) }),
}))

const messages = {
  en: {
    app: { title: 'Band Management', logout: 'Logout', confirmLogout: 'Are you sure?' },
    home: {
      title: 'Home', welcome: 'Hi, {name}!', subtitle: 'Overview',
      activeMembers: 'Active members', songs: 'Songs', upcomingEvents: 'Upcoming events',
      pendingEntries: 'Unpaid entries', none: 'None', open: 'Open',
      nextEvent: 'Next event', eventsThisMonth: 'Events this month', lastSong: 'Latest added',
      entries: 'Entries', lastEntry: 'Latest entry',
      members: 'Members', noMembers: 'No active members',
      recentActivity: 'Recent activity', noActivity: 'No activity',
    },
    finance: { title: 'Finances' },
    agenda: { title: 'Calendar' },
    songs: { title: 'Songs' },
    expenses: { loadingError: 'Error loading' },
    errors: { genericError: 'An error occurred' },
  },
}

const apiData = {
  '/api/members': [
    { id: 1, name: 'Ana', active: true },
    { id: 2, name: 'Bruno', active: false },
  ],
  '/api/songs': [
    { id: 1, title: 'Exagerado', createdAt: '2026-09-01T10:00:00.000Z' },
    { id: 2, title: 'Malandragem', createdAt: '2026-09-15T10:00:00.000Z' },
  ],
  '/api/events': [
    { id: 8, typeId: 2, type: { id: 2, name: 'Rehearsal' }, title: '', date: '2026-10-23', time: '19:00', songCount: 0 },
    { id: 7, typeId: 1, type: { id: 1, name: 'Show' }, title: 'Bar do Zé', date: '2026-10-24', time: '', songCount: 2 },
  ],
  '/api/expenses': [
    { id: 1, description: 'Cachê', amount: '500', paid: true, date: '2026-10-01' },
    { id: 2, description: 'Cordas', amount: '-80', paid: false, date: '2026-10-10' },
  ],
  '/api/logs': [],
}

function createWrapper() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages })

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dashboard', name: 'Dashboard', component: Dashboard },
      { path: '/agenda', name: 'Agenda', component: { template: '<div />' } },
      { path: '/integrantes', name: 'Members', component: { template: '<div />' } },
      { path: '/musicas', name: 'Songs', component: { template: '<div />' } },
      { path: '/financeiro', name: 'Finance', component: { template: '<div />' } },
      { path: '/login', name: 'Login', component: { template: '<div>Login</div>' } },
    ],
  })

  return mount(Dashboard, {
    global: {
      plugins: [i18n, router],
      stubs: {
        LanguageSelector: { template: '<div class="lang-stub"></div>' },
      },
    },
  })
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/health')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'ok' }) })
      const path = Object.keys(apiData).find((p) => url.includes(p))
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: path ? apiData[path] : [] }) })
    })
  })

  it('should show the band name in the header', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.find('h1').text()).toContain('Maverick')
  })

  it('should summarize members, songs, upcoming events and unpaid entries', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    const values = wrapper.findAll('.stat-value').map((v) => v.text())
    expect(values).toEqual(['1', '2', '2', '1'])
  })

  it('should only ask for events from today on', async () => {
    createWrapper()
    await flushPromises()
    const eventsUrl = mockFetch.mock.calls.map(([url]) => url).find((url) => url.includes('/api/events'))
    expect(eventsUrl).toMatch(/\/api\/events\?from=\d{4}-\d{2}-\d{2}$/)
  })

  it('should open each section from its summary block', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    const links = wrapper.findAll('a.stat').map((a) => a.attributes('href'))
    expect(links).toEqual(['/integrantes', '/musicas', '/agenda', '/financeiro?pago=nao'])
  })

  it('should link to the calendar, songs and finance pages', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    const links = wrapper.findAll('a.module-card').map((a) => a.attributes('href'))
    expect(links).toEqual(['/agenda', '/musicas', '/financeiro'])
  })

  it('should show the next event, latest song and entry', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    const text = wrapper.find('.modules').text()
    expect(text).toContain('Rehearsal · 10/23/2026 19:00')
    expect(text).not.toContain('Bar do Zé')
    expect(text).toContain('Malandragem')
    expect(text).toContain('Cordas')
  })

  it('should not display amounts', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.text()).not.toContain('R$')
  })

  it('should show error on API failure', async () => {
    mockFetch.mockImplementation(() => Promise.resolve({ ok: false }))
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.find('.alert-error').exists()).toBe(true)
  })
})
