import { ref, computed } from 'vue'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001'
const TOKEN_KEY = 'auth_token'
const MEMBER_KEY = 'auth_member'

// Shared state
const token = ref(localStorage.getItem(TOKEN_KEY) || '')
const member = ref(JSON.parse(localStorage.getItem(MEMBER_KEY) || 'null'))
const loading = ref(false)
const error = ref('')

function clearSession() {
  token.value = ''
  member.value = null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(MEMBER_KEY)
}

export function useAuth() {
  const isLoggedIn = computed(() => !!token.value && !!member.value)

  async function loginWithGoogle(credential) {
    loading.value = true
    error.value = ''

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      })

      if (!response.ok) {
        const error_data = await response.json()
        throw new Error(error_data.message || 'Login failed')
      }

      const data = await response.json()

      // Store token and member info
      token.value = data.data.token
      member.value = data.data.member

      localStorage.setItem(TOKEN_KEY, token.value)
      localStorage.setItem(MEMBER_KEY, JSON.stringify(member.value))

      return data.data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    loading.value = true
    error.value = ''

    try {
      if (token.value) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token.value}`,
          },
        })
      }
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      // Clear local state regardless of API response
      clearSession()
      loading.value = false
    }
  }

  async function logoutAll() {
    loading.value = true
    error.value = ''

    try {
      if (token.value) {
        await fetch(`${API_BASE_URL}/api/auth/logout/all`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token.value}`,
          },
        })
      }
    } catch (err) {
      console.error('Logout all error:', err)
    } finally {
      clearSession()
      loading.value = false
    }
  }

  async function getCurrentUser() {
    if (!token.value) {
      return null
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.value}`,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          // Token is invalid, clear it
          clearSession()
        }
        return null
      }

      const data = await response.json()
      if (data?.data) {
        member.value = {
          id: data.data.memberId,
          name: data.data.name,
          email: data.data.email,
        }
        localStorage.setItem(MEMBER_KEY, JSON.stringify(member.value))
      }
      return data.data
    } catch (err) {
      console.error('Error getting current user:', err)
      return null
    }
  }

  function getAuthHeader() {
    return token.value ? { Authorization: `Bearer ${token.value}` } : {}
  }

  return {
    token: computed(() => token.value),
    member: computed(() => member.value),
    isLoggedIn,
    loading,
    error,
    clearSession,
    loginWithGoogle,
    logout,
    logoutAll,
    getCurrentUser,
    getAuthHeader,
  }
}
