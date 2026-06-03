import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import Login from '../pages/Login.vue'
import Dashboard from '../pages/Dashboard.vue'

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
    path: '/',
    redirect: '/dashboard',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Navigation guard to check authentication
router.beforeEach((to, from, next) => {
  const { isLoggedIn } = useAuth()

  // If route requires auth and user is not logged in
  if (to.meta.requiresAuth && !isLoggedIn.value) {
    next({
      name: 'Login',
      query: { redirect: to.fullPath },
    })
  }
  // If user is logged in and trying to access login page
  else if (to.name === 'Login' && isLoggedIn.value) {
    next('/dashboard')
  }
  // Otherwise, proceed
  else {
    next()
  }
})

export default router
