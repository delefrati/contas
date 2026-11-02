import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import en from '../../i18n/locales/en.json'

const mockFetch = vi.fn()
global.fetch = mockFetch

const mockRenderGoogleButton = vi.fn()
vi.mock('../../utils/googleSignIn', () => ({
  renderGoogleButton: (...args) => mockRenderGoogleButton(...args),
}))

function reply(status, body) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) }
}

const bands = [
  { id: 1, slug: 'maverick', name: 'Maverick', active: true, createdAt: '2026-10-01T00:00:00Z', activeMembers: 4 },
  { id: 2, slug: 'velha', name: 'Velha', active: false, createdAt: '2026-01-01T00:00:00Z', activeMembers: 0 },
]

async function createWrapper() {
  const { default: AdminBands } = await import('./AdminBands.vue')
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin', component: AdminBands },
      { path: '/:other(.*)', component: { template: '<div />' } },
    ],
  })
  await router.push('/admin')

  const wrapper = mount(AdminBands, {
    global: {
      plugins: [i18n, router],
      stubs: {
        LanguageSelector: true,
        Modal: { template: '<div class="modal-stub" v-if="modelValue"><slot /></div>', props: ['modelValue', 'title'] },
      },
    },
  })
  await flushPromises()
  return wrapper
}

function signIn() {
  localStorage.setItem('admin_token', 'admin-token')
  localStorage.setItem('admin_user', JSON.stringify({ id: 3, name: 'Root', email: 'root@test.com' }))
}

describe('AdminBands', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    mockFetch.mockReset()
    mockRenderGoogleButton.mockReset()
  })

  it('should ask a signed-out visitor to sign in with Google', async () => {
    const wrapper = await createWrapper()

    expect(wrapper.find('.admin-login').exists()).toBe(true)
    expect(mockRenderGoogleButton).toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('should sign in and then list the bands', async () => {
    const wrapper = await createWrapper()
    mockFetch
      .mockResolvedValueOnce(reply(200, {
        data: { token: 'admin-token', superAdmin: { id: 3, name: 'Root', email: 'root@test.com' } },
      }))
      .mockResolvedValueOnce(reply(200, { data: bands }))

    const onCredential = mockRenderGoogleButton.mock.calls[0][1]
    await onCredential('google-credential')
    await flushPromises()

    expect(wrapper.find('.admin-login').exists()).toBe(false)
    expect(wrapper.text()).toContain('Maverick')
    expect(wrapper.text()).toContain('Disabled')
  })

  it('should show why a non super admin cannot sign in', async () => {
    const wrapper = await createWrapper()
    mockFetch.mockResolvedValueOnce(reply(400, { message: 'Only super admins can use the admin panel' }))

    await mockRenderGoogleButton.mock.calls[0][1]('google-credential')
    await flushPromises()

    expect(wrapper.find('.admin-login').text()).toContain('Only super admins can use the admin panel')
  })

  describe('signed in', () => {
    beforeEach(() => {
      signIn()
      mockFetch.mockImplementation(async (url, options) => {
        if (url.endsWith('/auth/me')) return reply(200, { data: { superAdminId: 3, name: 'Root', email: 'root@test.com' } })
        if (url.endsWith('/bands') && options.method === 'GET') return reply(200, { data: bands })
        if (url.endsWith('/bands') && options.method === 'POST') return reply(201, { data: { id: 5 } })
        return reply(404, {})
      })
    })

    it('should list every band with a link to manage it', async () => {
      const wrapper = await createWrapper()

      const rows = wrapper.findAll('tbody tr')
      expect(rows).toHaveLength(2)
      expect(rows[0].text()).toContain('maverick')
      expect(rows[0].text()).toContain('4')
      expect(rows[0].find('a[href="/admin/bandas/1"]').exists()).toBe(true)
    })

    it('should suggest the address from the name and create the band', async () => {
      const wrapper = await createWrapper()

      await wrapper.find('.section-actions .btn-primary').trigger('click')
      await wrapper.find('#band-name').setValue('Banda do Zé!')
      expect(wrapper.find('#band-slug').element.value).toBe('banda-do-ze')

      await wrapper.find('#first-member-name').setValue('Ana')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      const post = mockFetch.mock.calls.find(([, options]) => options.method === 'POST')
      expect(JSON.parse(post[1].body)).toEqual({
        name: 'Banda do Zé!',
        slug: 'banda-do-ze',
        member: { name: 'Ana' },
      })
      expect(wrapper.text()).toContain('Band created!')
    })

    it('should keep an address edited by hand', async () => {
      const wrapper = await createWrapper()

      await wrapper.find('.section-actions .btn-primary').trigger('click')
      await wrapper.find('#band-slug').setValue('zeh')
      await wrapper.find('#band-name').setValue('Banda do Zé')

      expect(wrapper.find('#band-slug').element.value).toBe('zeh')
    })
  })
})
