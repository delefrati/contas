import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ref } from 'vue'

// Track what useAuth returns for tests
const mockIsLoggedIn = ref(false)

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    isLoggedIn: mockIsLoggedIn,
    token: ref(mockIsLoggedIn.value ? 'token' : ''),
    member: ref(mockIsLoggedIn.value ? { id: 1, name: 'Test' } : null),
  }),
}))

async function createTestRouter() {
  const { useAuth } = await import('../composables/useAuth')
  const Login = { template: '<div>Login</div>' }
  const Dashboard = { template: '<div>Dashboard</div>' }

  const routes = [
    { path: '/login', name: 'Login', component: Login, meta: { requiresAuth: false } },
    { path: '/dashboard', name: 'Dashboard', component: Dashboard, meta: { requiresAuth: true } },
    { path: '/', redirect: '/dashboard' },
  ]

  const router = createRouter({ history: createMemoryHistory(), routes })

  router.beforeEach((to, from, next) => {
    const { isLoggedIn } = useAuth()

    if (to.meta.requiresAuth && !isLoggedIn.value) {
      next({ name: 'Login', query: { redirect: to.fullPath } })
    } else if (to.name === 'Login' && isLoggedIn.value) {
      next('/dashboard')
    } else {
      next()
    }
  })

  return router
}

describe('Router', () => {
  beforeEach(() => {
    mockIsLoggedIn.value = false
  })

  it('should redirect / to /dashboard when logged in', async () => {
    mockIsLoggedIn.value = true
    const router = await createTestRouter()
    await router.push('/')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/dashboard')
  })

  it('should redirect to login when accessing protected route unauthenticated', async () => {
    mockIsLoggedIn.value = false
    const router = await createTestRouter()
    await router.push('/dashboard')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('Login')
    expect(router.currentRoute.value.query.redirect).toBe('/dashboard')
  })

  it('should redirect logged-in user from login to dashboard', async () => {
    mockIsLoggedIn.value = true
    const router = await createTestRouter()
    await router.push('/login')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/dashboard')
  })

  it('should allow unauthenticated user to access login', async () => {
    mockIsLoggedIn.value = false
    const router = await createTestRouter()
    await router.push('/login')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('Login')
  })
})
