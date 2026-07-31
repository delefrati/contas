import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import Dashboard from './Dashboard.vue'

// Mock localStorage
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: vi.fn((key) => {
      if (key === 'auth_token') return 'fake-token'
      if (key === 'auth_member') return JSON.stringify({ id: 1, name: 'Test User' })
      if (key === 'language') return 'en'
      return null
    }),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
})

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock useAuth
vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    logout: vi.fn(),
    getCurrentUser: vi.fn().mockResolvedValue({ memberId: 1, name: 'Test User' }),
    getAuthHeader: () => ({ Authorization: 'Bearer fake-token' }),
    member: { value: { id: 1, name: 'Test User' } },
    isLoggedIn: { value: true },
    token: { value: 'fake-token' },
  }),
}))

const messages = {
  en: {
    app: { title: 'Expenses', logout: 'Logout', confirmLogout: 'Are you sure?' },
    tabs: { expenses: 'Expenses', report: 'Report', members: 'Members', logs: 'Logs' },
    expenses: {
      title: 'Expenses', noExpenses: 'No expenses', total: 'Total',
      loadingError: 'Error loading', successCreate: 'Created', successDelete: 'Deleted',
      successUpdate: 'Updated', date: 'Date', actions: 'Actions',
    },
    form: {
      description: 'Description', type: 'Type', amount: 'Amount', members: 'Members',
      addExpense: 'Add Expense', typeRequired: 'Type required', typeNameRequired: 'Name required',
    },
    filters: {
      toggle: 'Filter', text: 'Search', textPlaceholder: 'Search...',
      dateFrom: 'From', dateTo: 'To', allTypes: 'All', clear: 'Clear',
    },
    actions: { loading: 'Loading...', refresh: 'Refresh', edit: 'Edit', delete: 'Delete' },
    members: { nameRequired: 'Name required', successCreate: 'Created' },
    errors: { genericError: 'An error occurred' },
    language: { select: 'Language' },
  },
}

function createWrapper() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages })

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dashboard', name: 'Dashboard', component: Dashboard },
      { path: '/login', name: 'Login', component: { template: '<div>Login</div>' } },
    ],
  })

  return mount(Dashboard, {
    global: {
      plugins: [i18n, router],
      stubs: {
        LanguageSelector: { template: '<div class="lang-stub"></div>' },
        Modal: { template: '<div class="modal-stub"><slot /></div>', props: ['modelValue', 'title'] },
      },
    },
  })
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/health')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'ok' }) })
      if (url.includes('/api/expenses/report')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) })
      if (url.includes('/api/expenses')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) })
      if (url.includes('/api/members')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) })
      if (url.includes('/api/expense-types')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) })
      if (url.includes('/api/logs')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) })
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })
  })

  it('should render header with app title', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.find('h1').text()).toContain('Expenses')
  })

  it('should render all tabs', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    const tabs = wrapper.findAll('.tab-button')
    expect(tabs).toHaveLength(4)
    expect(tabs[0].text()).toContain('Expenses')
    expect(tabs[1].text()).toContain('Report')
    expect(tabs[2].text()).toContain('Members')
    expect(tabs[3].text()).toContain('Logs')
  })

  it('should show expenses tab by default', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.find('.tab-button.active').text()).toContain('Expenses')
  })

  it('should fetch data on mount', async () => {
    createWrapper()
    await flushPromises()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/health'),
      expect.any(Object),
    )
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/expenses'),
      expect.any(Object),
    )
  })

  it('should show empty state when no expenses', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })

  it('should switch tabs when clicked', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    const reportTab = wrapper.findAll('.tab-button')[1]
    await reportTab.trigger('click')
    expect(reportTab.classes()).toContain('active')
  })

  it('should display user name in header', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.find('.user-name').exists()).toBe(true)
  })

  it('should show error on API failure', async () => {
    mockFetch.mockImplementation(() => Promise.resolve({ ok: false }))
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.find('.alert-error').exists()).toBe(true)
  })
})
