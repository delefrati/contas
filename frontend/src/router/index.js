import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import Login from '../pages/Login.vue'
import Dashboard from '../pages/Dashboard.vue'
import Songs from '../pages/Songs.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresAuth: false },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true },
  },
  {
    path: '/repertorio',
    name: 'Songs',
    component: Songs,
    meta: { requiresAuth: true },
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Navigation guard to check authentication
router.beforeEach(async (to, from, next) => {
  const { isLoggedIn, token, getCurrentUser } = useAuth()

  if (to.meta.requiresAuth) {
    if (!isLoggedIn.value) {
      next({
        name: 'Login',
        query: { redirect: to.fullPath },
      })
      return
    }

    // Revalidate persisted session; if token was cleared by 401, force login.
    const hadToken = !!token.value
    const currentUser = await getCurrentUser()
    if (!currentUser && hadToken && !token.value) {
      next({
        name: 'Login',
        query: { redirect: to.fullPath, reason: 'expired' },
      })
      return
    }
  }

  if (to.name === 'Login' && isLoggedIn.value) {
    next('/dashboard')
    return
  }

  next()
})

export default router
