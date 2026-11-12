import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'
import OfflineBar from './OfflineBar.vue'

const state = vi.hoisted(() => ({}))

vi.mock('../offline/connection', async () => {
  const { ref } = await import('vue')
  state.connectionLost = ref(false)
  return { connectionLost: state.connectionLost }
})

vi.mock('../offline/snapshot', async () => {
  const { ref } = await import('vue')
  state.copyInfo = ref(null)
  return { copyInfo: state.copyInfo, STALE_COPY_AGE_MS: 24 * 60 * 60 * 1000 }
})

const sessionExpired = ref(false)
const syncCopy = vi.fn()
vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({ sessionExpired, syncCopy }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ fullPath: '/agenda' }),
  useRouter: () => ({ push: vi.fn() }),
}))

const messages = {
  en: {
    actions: { loading: 'Loading...' },
    offline: {
      saved: 'Available offline. Updated {when}.',
      offline: 'Offline. Showing data from {when}.',
      downloadFailed: 'Could not download now.',
      tapToUpdate: 'Tap to update',
      stale: 'May be out of date.',
    },
  },
}

function mountBar() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages })
  return mount(OfflineBar, { global: { plugins: [i18n] } })
}

describe('OfflineBar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] })
    vi.clearAllMocks()
    localStorage.clear()
    sessionExpired.value = false
    state.connectionLost.value = false
    state.copyInfo.value = { savedAt: Date.now() - 10 * 60_000 }
    syncCopy.mockImplementation(async () => {
      state.copyInfo.value = { savedAt: Date.now() }
      return 'saved'
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should download again when tapped, show it worked, then hide for a while', async () => {
    const wrapper = mountBar()
    const strip = wrapper.find('button.offline-bar')
    expect(strip.text()).toContain('Tap to update')

    await strip.trigger('click')
    await flushPromises()
    expect(syncCopy).toHaveBeenCalledWith({ force: true })
    expect(wrapper.find('.offline-bar').text()).toContain('Updated')

    vi.advanceTimersByTime(2000)
    await flushPromises()
    expect(wrapper.find('.offline-bar').exists()).toBe(false)

    // Still hidden on the next screen, back after an hour
    expect(mountBar().find('.offline-bar').exists()).toBe(false)
    vi.advanceTimersByTime(59 * 60 * 1000)
    expect(mountBar().find('.offline-bar').exists()).toBe(false)
    vi.advanceTimersByTime(60 * 1000)
    expect(mountBar().find('.offline-bar').exists()).toBe(true)
  })

  it('should stay, with the error, when the download fails', async () => {
    syncCopy.mockResolvedValue('failed')
    const wrapper = mountBar()

    await wrapper.find('button.offline-bar').trigger('click')
    await flushPromises()
    vi.advanceTimersByTime(5000)
    await flushPromises()
    const strip = wrapper.find('button.offline-bar')
    expect(strip.text()).toContain('Could not download now.')
    expect(strip.classes()).toContain('is-warning')
    expect(strip.attributes('disabled')).toBeUndefined()
  })

  it('should keep showing the offline warning, which is not tappable', async () => {
    localStorage.setItem('offline_bar_hidden_until', String(Date.now() + 60_000))
    state.connectionLost.value = true
    const wrapper = mountBar()
    expect(wrapper.find('div.offline-bar').text()).toContain('Offline.')
    expect(wrapper.find('button.offline-bar').exists()).toBe(false)
  })
})
