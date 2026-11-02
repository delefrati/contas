import { computed, ref } from 'vue'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'
// Kept apart from the band session (auth_token): locally both live on the same origin
const TOKEN_KEY = 'admin_token'
const ADMIN_KEY = 'admin_user'

const token = ref(localStorage.getItem(TOKEN_KEY) || '')
const admin = ref(JSON.parse(localStorage.getItem(ADMIN_KEY) || 'null'))
// Set when the API rejected the session, so the login screen can say why
const expired = ref(false)

function storeSession(data) {
  token.value = data.token
  admin.value = data.superAdmin
  expired.value = false
  localStorage.setItem(TOKEN_KEY, token.value)
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin.value))
}

function clearSession() {
  token.value = ''
  admin.value = null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ADMIN_KEY)
}

// Calls /api/admin<path>; throws an Error with the API's message on failure
async function request(method, path, body) {
  const response = await fetch(`${API_BASE_URL}/api/admin${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token.value && { Authorization: `Bearer ${token.value}` }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => null)

  if (response.status === 401 && token.value) {
    clearSession()
    expired.value = true
  }
  if (!response.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message
    throw new Error(message || `Request failed (${response.status})`)
  }
  return data?.data
}

export function useAdmin() {
  const isLoggedIn = computed(() => !!token.value && !!admin.value)

  async function login(credential) {
    storeSession(await request('POST', '/auth/google', { credential }))
  }

  async function logout() {
    try {
      if (token.value) await request('POST', '/auth/logout')
    } catch {
      // The session is dropped locally either way
    } finally {
      clearSession()
    }
  }

  // Revalidates a stored session; clears it when the API no longer accepts it
  async function refresh() {
    if (!token.value) return null
    try {
      const me = await request('GET', '/auth/me')
      admin.value = { id: me.superAdminId, name: me.name, email: me.email }
      localStorage.setItem(ADMIN_KEY, JSON.stringify(admin.value))
      return admin.value
    } catch {
      return null
    }
  }

  return {
    admin: computed(() => admin.value),
    isLoggedIn,
    expired: computed(() => expired.value),
    login,
    logout,
    refresh,
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body ?? {}),
    patch: (path, body) => request('PATCH', path, body ?? {}),
  }
}
