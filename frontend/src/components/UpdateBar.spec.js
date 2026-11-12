import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'
import UpdateBar from './UpdateBar.vue'

const DAY_MS = 24 * 60 * 60 * 1000

const state = vi.hoisted(() => ({}))

vi.mock('../offline/pwa', async () => {
  const { ref } = await import('vue')
  state.updateReady = ref(false)
  state.applyUpdate = vi.fn()
  return { updateReady: state.updateReady, applyUpdate: () => state.applyUpdate() }
})

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

const isLoggedIn = ref(true)
const syncCopy = vi.fn()
vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({ isLoggedIn, syncCopy }),
}))

const messages = {
  en: {
    update: { available: 'A new version is available.', apply: 'Update', dataStale: 'Data may be out of date.' },
    offline: { downloadFailed: 'Could not download now.' },
  },
}

function mountBar() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages })
  return mount(UpdateBar, { global: { plugins: [i18n] } })
}

describe('UpdateBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isLoggedIn.value = true
    state.updateReady.value = false
    state.connectionLost.value = false
    state.copyInfo.value = { savedAt: Date.now() - 60_000 }
    // A successful download refreshes the copy
    syncCopy.mockImplementation(async () => {
      state.copyInfo.value = { savedAt: Date.now() }
      return 'saved'
    })
  })

  it('should stay hidden while everything is up to date', () => {
    expect(mountBar().find('.update-bar').exists()).toBe(false)
  })

  it('should download the data and then switch to the new version', async () => {
    state.updateReady.value = true
    const wrapper = mountBar()
    expect(wrapper.text()).toContain('A new version is available.')

    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(syncCopy).toHaveBeenCalledWith({ force: true })
    expect(state.applyUpdate).toHaveBeenCalledTimes(1)
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('should switch to the new version without a connection, skipping the download', async () => {
    state.updateReady.value = true
    state.connectionLost.value = true
    const wrapper = mountBar()

    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(syncCopy).not.toHaveBeenCalled()
    expect(state.applyUpdate).toHaveBeenCalledTimes(1)
  })

  it('should offer to download data that stopped updating, and go away once it does', async () => {
    state.copyInfo.value = { savedAt: Date.now() - 2 * DAY_MS }
    const wrapper = mountBar()
    expect(wrapper.text()).toContain('Data may be out of date.')

    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(syncCopy).toHaveBeenCalledWith({ force: true })
    expect(state.applyUpdate).not.toHaveBeenCalled()
    expect(wrapper.find('.update-bar').exists()).toBe(false)
  })

  it('should say so when the download fails, and let it be tried again', async () => {
    state.copyInfo.value = { savedAt: Date.now() - 2 * DAY_MS }
    syncCopy.mockResolvedValue('failed')
    const wrapper = mountBar()

    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Could not download now.')
    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()
  })

  it('should not ask for a download without a connection or a session', () => {
    state.copyInfo.value = { savedAt: Date.now() - 2 * DAY_MS }
    state.connectionLost.value = true
    expect(mountBar().find('.update-bar').exists()).toBe(false)

    state.connectionLost.value = false
    isLoggedIn.value = false
    expect(mountBar().find('.update-bar').exists()).toBe(false)
  })
})
