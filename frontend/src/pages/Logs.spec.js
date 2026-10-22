import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ref } from 'vue'
import Logs from './Logs.vue'

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
  }),
}))

const messages = {
  en: {
    app: { logout: 'Logout', language: 'Language', confirmLogout: 'Are you sure?' },
    home: { title: 'Home' },
    repertoire: { title: 'Repertoire' },
    finance: { title: 'Finances' },
    members: { title: 'Members' },
    logs: {
      title: 'Logs', action: 'Action', resource: 'Resource', resourceId: 'Resource ID',
      user: 'User', details: 'Details', createdAt: 'Created at', noLogs: 'No logs',
      loadingError: 'Error loading logs',
    },
    actions: { loading: 'Loading...', refresh: 'Refresh' },
    errors: { genericError: 'An error occurred' },
  },
}

async function createWrapper() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages })

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/registros', name: 'Logs', component: Logs },
      { path: '/:other(.*)', component: { template: '<div />' } },
    ],
  })
  await router.push('/registros')

  return mount(Logs, {
    global: {
      plugins: [i18n, router],
      stubs: {
        LanguageSelector: { template: '<div class="lang-stub"></div>' },
      },
    },
  })
}

describe('Logs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 2, action: 'UPDATE', resource: 'song', resourceId: 5, userName: 'Alice', details: '{"title":"Exagerado"}', createdAt: '2026-10-18T12:00:00.000Z' },
          { id: 1, action: 'CREATE', resource: 'expense', resourceId: 1, userName: 'Bob', createdAt: '2026-10-17T12:00:00.000Z' },
        ],
      }),
    })
  })

  it('should fetch the latest logs', async () => {
    await createWrapper()
    await flushPromises()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/logs?limit=100'),
      expect.any(Object),
    )
  })

  it('should list logs', async () => {
    const wrapper = await createWrapper()
    await flushPromises()
    const rows = wrapper.findAll('tbody tr.expense-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('UPDATE')
    expect(rows[0].text()).toContain('Alice')
  })

  it('should expand log details', async () => {
    const wrapper = await createWrapper()
    await flushPromises()
    await wrapper.find('.btn-dots').trigger('click')
    expect(wrapper.find('.log-expanded-details').text()).toContain('Exagerado')
  })

  it('should show empty state when there are no logs', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [] }) })
    const wrapper = await createWrapper()
    await flushPromises()
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })
})
