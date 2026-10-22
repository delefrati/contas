import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ref } from 'vue'
import Members from './Members.vue'

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
    logs: { title: 'Logs' },
    members: {
      title: 'Members', addMember: 'Add Member', noMembers: 'No members', name: 'Name',
      email: 'Email', status: 'Status', actions: 'Actions', active: 'Active', inactive: 'Inactive',
      enable: 'Enable', disable: 'Disable', editMember: 'Edit Member', nameRequired: 'Name required',
      successCreate: 'Created', successUpdate: 'Updated', loadingError: 'Error loading members',
    },
    actions: { loading: 'Loading...', refresh: 'Refresh', save: 'Save' },
    errors: { genericError: 'An error occurred' },
  },
}

async function createWrapper() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages })

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/integrantes', name: 'Members', component: Members },
      { path: '/:other(.*)', component: { template: '<div />' } },
    ],
  })
  await router.push('/integrantes')

  return mount(Members, {
    global: {
      plugins: [i18n, router],
      stubs: {
        LanguageSelector: { template: '<div class="lang-stub"></div>' },
        Modal: { template: '<div class="modal-stub"><slot /></div>', props: ['modelValue', 'title'] },
      },
    },
  })
}

describe('Members', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 1, name: 'Alice', email: 'alice@test.com', active: true },
          { id: 2, name: 'Bob', email: null, active: false },
        ],
      }),
    })
  })

  it('should render the members title', async () => {
    const wrapper = await createWrapper()
    await flushPromises()
    expect(wrapper.find('h1').text()).toContain('Members')
  })

  it('should list members with their status', async () => {
    const wrapper = await createWrapper()
    await flushPromises()
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Alice')
    expect(rows[0].text()).toContain('Active')
    expect(rows[1].text()).toContain('Inactive')
  })

  it('should link to the other sections but not to itself', async () => {
    const wrapper = await createWrapper()
    await flushPromises()
    const links = wrapper.findAll('.nav-link').map((a) => a.attributes('href'))
    expect(links).toEqual(['/dashboard', '/repertorio', '/financeiro', '/registros'])
  })

  it('should toggle a member', async () => {
    const wrapper = await createWrapper()
    await flushPromises()
    await wrapper.findAll('tbody tr')[0].findAll('button')[1].trigger('click')
    await flushPromises()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/members/1/toggle-active'),
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('should show error on API failure', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 })
    const wrapper = await createWrapper()
    await flushPromises()
    expect(wrapper.find('.alert-error').text()).toContain('Error loading members')
  })
})
