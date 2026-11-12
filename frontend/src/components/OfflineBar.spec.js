import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
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
vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({ sessionExpired }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ fullPath: '/agenda' }),
  useRouter: () => ({ push: vi.fn() }),
}))

const messages = {
  en: {
    offline: {
      offline: 'Offline. Showing data from {when}.',
      expired: 'Your session expired. Showing data from {when}.',
      noCopy: 'Offline, and nothing was downloaded on this device yet.',
      stale: 'May be out of date.',
      signIn: 'Sign in to update',
    },
  },
}

function mountBar() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages })
  return mount(OfflineBar, { global: { plugins: [i18n] } })
}

describe('OfflineBar', () => {
  beforeEach(() => {
    sessionExpired.value = false
    state.connectionLost.value = false
    state.copyInfo.value = { savedAt: Date.now() - 10 * 60_000 }
  })

  it('stays out of the way while everything is fine', () => {
    expect(mountBar().find('.offline-bar').exists()).toBe(false)
  })

  it('says the data shown is the downloaded copy when there is no connection', () => {
    state.connectionLost.value = true
    const text = mountBar().find('.offline-bar').text()
    expect(text).toContain('Offline. Showing data from 10 minutes ago.')
    expect(text).not.toContain('May be out of date.')
  })

  it('warns when that copy is more than a day old', () => {
    state.connectionLost.value = true
    state.copyInfo.value = { savedAt: Date.now() - 2 * 24 * 60 * 60_000 }
    expect(mountBar().find('.offline-bar').text()).toContain('May be out of date.')
  })

  it('says when nothing was downloaded yet', () => {
    state.connectionLost.value = true
    state.copyInfo.value = null
    expect(mountBar().find('.offline-bar').text()).toContain('nothing was downloaded')
  })

  it('offers to sign in again when the session expired', () => {
    sessionExpired.value = true
    const bar = mountBar().find('.offline-bar')
    expect(bar.text()).toContain('Your session expired.')
    expect(bar.find('button').text()).toBe('Sign in to update')
  })
})
