import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import Login from './Login.vue'

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
    loginWithGoogle: vi.fn(),
    loading: ref(false),
    isLoggedIn: ref(false),
    token: ref(''),
    member: ref(null),
  }),
}))

function createWrapper() {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
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
})
