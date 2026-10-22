import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import Login from '../pages/Login.vue'
import Dashboard from '../pages/Dashboard.vue'
import Finance from '../pages/Finance.vue'
import Members from '../pages/Members.vue'
import Logs from '../pages/Logs.vue'
import Songs from '../pages/Songs.vue'
import Agenda from '../pages/Agenda.vue'
import EventDetail from '../pages/EventDetail.vue'
import AuthCallback from '../pages/AuthCallback.vue'
import { centralLoginUrl, currentBandSlug, isCentralHost } from '../hosts'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresAuth: false, titleKey: 'login.title' },
  },
  {
    path: '/entrar',
    name: 'CentralLogin',
    component: Login,
    meta: { requiresAuth: false, titleKey: 'login.title' },
  },
  {
    path: '/auth/callback',
    name: 'AuthCallback',
    component: AuthCallback,
    meta: { requiresAuth: false, titleKey: 'login.title' },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true, titleKey: 'home.title' },
  },
  {
    path: '/financeiro',
    name: 'Finance',
    component: Finance,
    meta: { requiresAuth: true, titleKey: 'finance.title' },
  },
  {
    path: '/integrantes',
    name: 'Members',
    component: Members,
    meta: { requiresAuth: true, titleKey: 'members.title' },
  },
  {
    path: '/registros',
    name: 'Logs',
    component: Logs,
    meta: { requiresAuth: true, titleKey: 'logs.title' },
  },
  {
    path: '/agenda',
    name: 'Agenda',
    component: Agenda,
    meta: { requiresAuth: true, titleKey: 'agenda.title' },
  },
  {
    path: '/agenda/:id(\\d+)',
    name: 'Event',
    component: EventDetail,
    meta: { requiresAuth: true, titleKey: 'agenda.title' },
  },
  {
    path: '/musicas',
    name: 'Songs',
    component: Songs,
    meta: { requiresAuth: true, titleKey: 'songs.title' },
  },
  {
    // Former address of the songs and setlists page
    path: '/repertorio',
    redirect: '/musicas',
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
  // The central host (BASE_DOMAIN) only serves the login page
  if (isCentralHost()) {
    if (to.name !== 'CentralLogin') {
      next({ name: 'CentralLogin', query: to.query })
      return
    }
    next()
    return
  }
  if (to.name === 'CentralLogin') {
    next({ name: 'Login', query: to.query })
    return
  }

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

  // Band subdomains log in through the central host
  if (to.name === 'Login' && currentBandSlug()) {
    window.location.assign(centralLoginUrl(to.query.redirect))
    next(false)
    return
  }

  next()
})

export default router
