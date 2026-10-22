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
      activeMembers: 'Active members', songs: 'Songs', repertoires: 'Setlists',
      pendingEntries: 'Unpaid entries', none: 'None', open: 'Open',
      lastRepertoire: 'Latest setlist', entries: 'Entries', lastEntry: 'Latest entry',
      members: 'Members', noMembers: 'No active members',
      recentActivity: 'Recent activity', noActivity: 'No activity',
    },
    finance: { title: 'Finances' },
    repertoire: { title: 'Repertoire' },
    expenses: { loadingError: 'Error loading' },
    errors: { genericError: 'An error occurred' },
  },
}

const apiData = {
  '/api/members': [
    { id: 1, name: 'Ana', active: true },
    { id: 2, name: 'Bruno', active: false },
  ],
  '/api/songs': [{ id: 1, title: 'Exagerado' }, { id: 2, title: 'Malandragem' }],
  '/api/repertoires': [{ id: 7, name: 'Show de sábado', date: '2026-10-18', songCount: 2 }],
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
      { path: '/repertorio', name: 'Songs', component: { template: '<div />' } },
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

  it('should summarize members, songs, setlists and unpaid entries', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    const values = wrapper.findAll('.stat-value').map((v) => v.text())
    expect(values).toEqual(['1', '2', '1', '1'])
  })

  it('should link to the repertoire and finance pages', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    const links = wrapper.findAll('a.module-card').map((a) => a.attributes('href'))
    expect(links).toEqual(['/repertorio', '/financeiro'])
  })

  it('should show the latest setlist and entry', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    const text = wrapper.find('.modules').text()
    expect(text).toContain('Show de sábado')
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
