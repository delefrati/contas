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
import Manual from '../pages/Manual.vue'
import NotFound from '../pages/NotFound.vue'
import AdminBands from '../pages/admin/AdminBands.vue'
import AdminBand from '../pages/admin/AdminBand.vue'
import AdminSuperAdmins from '../pages/admin/AdminSuperAdmins.vue'
import { adminUrl, centralLoginUrl, currentBandSlug, isCentralHost } from '../hosts'
import { loadBand } from '../composables/useBand'
import { connectionLost } from '../offline/connection'

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
    meta: { requiresAuth: true, offline: true, titleKey: 'agenda.title' },
  },
  {
    path: '/agenda/:id(\\d+)',
    name: 'Event',
    component: EventDetail,
    meta: { requiresAuth: true, offline: true, titleKey: 'agenda.title' },
  },
  {
    path: '/musicas',
    name: 'Songs',
    component: Songs,
    meta: { requiresAuth: true, offline: true, titleKey: 'songs.title' },
  },
  {
    // Former address of the songs and setlists page
    path: '/repertorio',
    redirect: '/musicas',
  },
  // Admin panel for super admins, on the central host (it signs in on its own, see AdminLayout)
  {
    path: '/admin',
    name: 'AdminBands',
    component: AdminBands,
    meta: { admin: true, titleKey: 'admin.bands.title' },
  },
  {
    path: '/admin/bandas/:id(\\d+)',
    name: 'AdminBand',
    component: AdminBand,
    meta: { admin: true, titleKey: 'admin.bands.title' },
  },
  {
    path: '/admin/super-admins',
    name: 'AdminSuperAdmins',
    component: AdminSuperAdmins,
    meta: { admin: true, titleKey: 'admin.superAdmins.title' },
  },
  // The user manual, the same on every host: it opens signed out and offline (see the guard)
  {
    path: '/ajuda/:part?',
    name: 'Manual',
    component: Manual,
    meta: { requiresAuth: false, offline: true, manual: true, titleKey: 'manual.title' },
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
  // Any other address, on every host: like the manual, it needs no band, session or connection
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFound,
    meta: { requiresAuth: false, notFound: true, titleKey: 'notFound.title' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Navigation guard to check authentication
router.beforeEach(async (to, from, next) => {
  // Static text bundled with the app (the manual, the not found page): no band, session or
  // connection to wait for, so someone who can't sign in, or has no signal, can still read it
  if (to.meta.manual || to.meta.notFound) {
    next()
    return
  }

  if (to.meta.admin) {
    // Band subdomains don't serve the admin panel
    if (currentBandSlug()) {
      window.location.assign(adminUrl(to.fullPath))
      next(false)
      return
    }
    next()
    return
  }

  // Besides the admin panel, the central host (BASE_DOMAIN) only serves the login page
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

  const { isLoggedIn, token, getCurrentUser, readCopy, revalidateSession, syncCopy } = useAuth()

  // These screens open from the downloaded copy at once, whatever the signal is doing
  if (to.meta.offline && (await readCopy())) {
    revalidateSession().then(() => syncCopy())
    next()
    return
  }

  // Must settle before the login redirect below, which would carry the unknown band along
  if (currentBandSlug() && !(await loadBand())) {
    next(false)
    return
  }

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
    syncCopy()
  }

  if (to.name === 'Login' && isLoggedIn.value) {
    next('/dashboard')
    return
  }

  // Band subdomains log in through the central host
  if (to.name === 'Login' && currentBandSlug()) {
    // Without a connection, stay and let App explain instead of a browser error page
    if (connectionLost.value) {
      next()
      return
    }
    window.location.assign(centralLoginUrl(to.query.redirect))
    next(false)
    return
  }

  next()
})

export default router
