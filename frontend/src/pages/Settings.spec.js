import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ref } from 'vue'
import Settings from './Settings.vue'
import pt from '../i18n/locales/pt.json'
import { theme } from '../theme'
import { connectionLost } from '../offline/connection'
import { copyInfo } from '../offline/snapshot'

const mockFetch = vi.fn()
global.fetch = mockFetch

const member = ref(null)
const sessionExpired = ref(false)
const syncCopy = vi.fn()
const getCurrentUser = vi.fn()
const handleUnauthorized = vi.fn()

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    member,
    sessionExpired,
    syncCopy,
    getCurrentUser,
    handleUnauthorized,
    logout: vi.fn(),
    getAuthHeader: () => ({ Authorization: 'Bearer fake-token' }),
  }),
}))

async function mountSettings() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/configuracoes', name: 'Settings', component: Settings },
      { path: '/:other(.*)', component: { template: '<div />' } },
    ],
  })
  await router.push('/configuracoes')
  const i18n = createI18n({ legacy: false, locale: 'pt', messages: { pt } })
  const wrapper = mount(Settings, { global: { plugins: [i18n, router] } })
  await flushPromises()
  return { wrapper, router }
}

function saveButton(wrapper) {
  return wrapper.find('form button[type="submit"]')
}

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    member.value = { id: 7, name: 'Ana', email: 'ana@test.com' }
    sessionExpired.value = false
    connectionLost.value = false
    copyInfo.value = null
    theme.value = 'system'
    localStorage.clear()
  })

  describe('my details', () => {
    it('shows the name to change and the email it signs in with', async () => {
      const { wrapper } = await mountSettings()
      expect(wrapper.find('#settings-name').element.value).toBe('Ana')
      const email = wrapper.find('#settings-email')
      expect(email.element.value).toBe('ana@test.com')
      expect(email.attributes('disabled')).toBeDefined()
      expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    })

    it('saves a new name and brings it into the session', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ data: {} }) })
      getCurrentUser.mockImplementation(async () => {
        member.value = { ...member.value, name: 'Ana Paula' }
      })
      const { wrapper } = await mountSettings()

      await wrapper.find('#settings-name').setValue('  Ana Paula ')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8001/api/members/7', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fake-token' },
        body: JSON.stringify({ name: 'Ana Paula' }),
      })
      expect(getCurrentUser).toHaveBeenCalled()
      expect(wrapper.find('#settings-name').element.value).toBe('Ana Paula')
      expect(wrapper.text()).toContain(pt.settings.saved)
    })

    it('does not save an empty name', async () => {
      const { wrapper } = await mountSettings()
      await wrapper.find('#settings-name').setValue('   ')
      await wrapper.find('form').trigger('submit')
      await flushPromises()
      expect(mockFetch).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain(pt.members.nameRequired)
    })

    it('shows what the server said when it refuses', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve({ message: 'Nope' }) })
      const { wrapper } = await mountSettings()
      await wrapper.find('#settings-name').setValue('Outra')
      await wrapper.find('form').trigger('submit')
      await flushPromises()
      expect(wrapper.find('.alert-error').text()).toBe('Nope')
    })

    it('sends an expired session to the login', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) })
      const { wrapper, router } = await mountSettings()
      await wrapper.find('#settings-name').setValue('Outra')
      await wrapper.find('form').trigger('submit')
      await flushPromises()
      expect(handleUnauthorized).toHaveBeenCalled()
      expect(router.currentRoute.value.path).toBe('/login')
    })

    it('needs a connection to save', async () => {
      connectionLost.value = true
      const { wrapper } = await mountSettings()
      await wrapper.find('#settings-name').setValue('Outra')
      expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
      expect(wrapper.text()).toContain(pt.settings.needsConnection)
    })

    it('only shows a super admin who is not in the band their details', async () => {
      member.value = { name: 'Root', email: 'root@test.com', superAdmin: true }
      const { wrapper } = await mountSettings()
      expect(wrapper.find('#settings-name').attributes('disabled')).toBeDefined()
      expect(saveButton(wrapper).exists()).toBe(false)
      expect(wrapper.text()).toContain(pt.settings.superAdminHint)
    })
  })

  describe('appearance', () => {
    it('switches between system, light and dark', async () => {
      const { wrapper } = await mountSettings()
      const option = (name) => wrapper.find(`[data-theme-option="${name}"]`)
      expect(option('system').attributes('aria-checked')).toBe('true')

      await option('dark').trigger('click')
      expect(theme.value).toBe('dark')
      expect(document.documentElement.dataset.theme).toBe('dark')
      expect(option('dark').attributes('aria-checked')).toBe('true')

      await option('light').trigger('click')
      expect(document.documentElement.dataset.theme).toBe('light')

      await option('system').trigger('click')
      expect(document.documentElement.dataset.theme).toBeUndefined()
    })

    it('changes the language and keeps it on this device', async () => {
      const { wrapper } = await mountSettings()
      await wrapper.find('#settings-language').setValue('en')
      expect(localStorage.getItem('language')).toBe('en')
    })
  })

  describe('data on this device', () => {
    function refreshButton(wrapper) {
      return wrapper.findAll('button').find((b) => b.text().includes(pt.settings.refresh))
    }

    it('says when the data was downloaded', async () => {
      copyInfo.value = { savedAt: Date.now() - 5 * 60_000 }
      const { wrapper } = await mountSettings()
      expect(wrapper.text()).toContain('Atualizados há 5 minutos.')
    })

    it('says when nothing was downloaded yet', async () => {
      const { wrapper } = await mountSettings()
      expect(wrapper.text()).toContain(pt.settings.noCopy)
    })

    it('downloads everything again on request', async () => {
      syncCopy.mockResolvedValue('saved')
      const { wrapper } = await mountSettings()
      await refreshButton(wrapper).trigger('click')
      await flushPromises()
      expect(syncCopy).toHaveBeenCalledWith({ force: true })
      expect(wrapper.text()).toContain(pt.settings.refreshed)
    })

    it('tries even when the connection seemed lost, and says when it fails', async () => {
      connectionLost.value = true
      syncCopy.mockResolvedValue('failed')
      const { wrapper } = await mountSettings()
      await refreshButton(wrapper).trigger('click')
      await flushPromises()
      expect(syncCopy).toHaveBeenCalled()
      expect(wrapper.text()).toContain(pt.settings.refreshFailed)
    })

    it('asks to sign in again when the session expired', async () => {
      sessionExpired.value = true
      const { wrapper, router } = await mountSettings()
      expect(refreshButton(wrapper)).toBeUndefined()
      expect(wrapper.text()).toContain(pt.settings.expired)
      await wrapper.findAll('button').find((b) => b.text() === pt.offline.signIn).trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/login')
    })
  })
})
