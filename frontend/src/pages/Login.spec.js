import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import Login from './Login.vue'
import pt from '../i18n/locales/pt.json'

const auth = vi.hoisted(() => ({ loginWithGoogle: null, centralLogin: null, googleCallback: null, central: false }))

// Capture the callback Google would call with the signed-in account's credential
vi.mock('../utils/googleSignIn', () => ({
  renderGoogleButton: (element, callback) => { auth.googleCallback = callback },
}))

vi.mock('../hosts', async (importOriginal) => ({
  ...(await importOriginal()),
  isCentralHost: () => auth.central,
}))

// Mock localStorage
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
})

// Mock useAuth
vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    loginWithGoogle: (...args) => auth.loginWithGoogle(...args),
    centralLogin: (...args) => auth.centralLogin(...args),
    loading: ref(false),
    isLoggedIn: ref(false),
    token: ref(''),
    member: ref(null),
  }),
}))

function createWrapper(locale = 'en') {
  const i18n = createI18n({
    legacy: false,
    locale,
    messages: {
      pt,
      en: {
        login: {
          title: 'Login',
          subtitle: 'Sign in to continue',
          loggingIn: 'Logging in...',
          info: 'Contact admin for access',
          loginFailed: 'Login failed',
        },
      },
    },
  })

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'Login', component: Login },
      { path: '/dashboard', name: 'Dashboard', component: { template: '<div>Dashboard</div>' } },
    ],
  })

  return mount(Login, {
    global: { plugins: [i18n, router] },
  })
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window.google
    global.window = Object.create(window)
    Object.defineProperty(window, 'google', {
      value: undefined,
      writable: true,
      configurable: true,
    })
  })

  it('should render login card with title and subtitle', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('h1').text()).toBe('Login')
    expect(wrapper.find('.subtitle').text()).toBe('Sign in to continue')
  })

  it('should render google signin button container', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('#google-signin-btn').exists()).toBe(true)
  })

  it('should render info section', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('.login-info').text()).toContain('Contact admin for access')
  })

  it('should not show error initially', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('.error-message').exists()).toBe(false)
  })

  it('should not show loading initially', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('.loading-message').exists()).toBe(false)
  })

  describe('when the server refuses the sign-in', () => {
    function refusal(code) {
      const err = new Error('Member not found. Please contact an administrator.')
      err.code = code
      return err
    }

    beforeEach(() => {
      auth.central = false
      auth.loginWithGoogle = vi.fn()
      auth.centralLogin = vi.fn()
    })

    it.each([
      ['MEMBER_NOT_FOUND', 'Sua conta não está cadastrada. Fale com um administrador da banda.'],
      ['MEMBER_NOT_IN_BAND', 'Sua conta não está cadastrada nesta banda. Fale com um administrador da banda.'],
      ['MEMBER_DISABLED', 'Sua conta está desativada. Fale com um administrador da banda.'],
    ])('should say %s in Portuguese', async (code, text) => {
      auth.loginWithGoogle.mockRejectedValue(refusal(code))
      const wrapper = createWrapper('pt')
      await auth.googleCallback('credential')
      await flushPromises()
      expect(wrapper.find('.error-message').text()).toBe(text)
    })

    it('should say it in Portuguese on the central host too', async () => {
      auth.central = true
      auth.centralLogin.mockRejectedValue(refusal('MEMBER_NOT_IN_BAND'))
      const wrapper = createWrapper('pt')
      await auth.googleCallback('credential')
      await flushPromises()
      expect(wrapper.find('.error-message').text()).toBe(
        'Sua conta não está cadastrada nesta banda. Fale com um administrador da banda.',
      )
    })

    it('should fall back to the generic failure for anything else, never the English message', async () => {
      auth.loginWithGoogle.mockRejectedValue(new Error('Invalid Google token'))
      const wrapper = createWrapper('pt')
      await auth.googleCallback('credential')
      await flushPromises()
      expect(wrapper.find('.error-message').text()).toBe('Falha ao entrar. Tente novamente.')
    })
  })
})
