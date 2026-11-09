import { ref, computed } from 'vue'
import { ConnectionError, fetchJson } from '../offline/connection'
import { accessRevoked, keepCopyOnlyFor, readSnapshot, syncSnapshot, wipeCopy } from '../offline/snapshot'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'
const TOKEN_KEY = 'auth_token'
const MEMBER_KEY = 'auth_member'
// A session that ran out, kept only so a later check can still notice access was taken away
const EXPIRED_TOKEN_KEY = 'auth_expired_token'
const COPY_SYNC_DELAY_MS = 3000

// Shared state
const token = ref(localStorage.getItem(TOKEN_KEY) || '')
const member = ref(JSON.parse(localStorage.getItem(MEMBER_KEY) || 'null'))
const expiredToken = ref(localStorage.getItem(EXPIRED_TOKEN_KEY) || '')
const loading = ref(false)
const error = ref('')
let unauthorizedCheck = null
let copySyncTimer = null

function setExpiredToken(value) {
  expiredToken.value = value
  if (value) localStorage.setItem(EXPIRED_TOKEN_KEY, value)
  else localStorage.removeItem(EXPIRED_TOKEN_KEY)
}

function ownerKey(owner) {
  return owner.superAdmin ? `s:${owner.email}` : `m:${owner.id}`
}

function storeSession(data) {
  token.value = data.token
  member.value = data.member
  localStorage.setItem(TOKEN_KEY, token.value)
  localStorage.setItem(MEMBER_KEY, JSON.stringify(member.value))
  setExpiredToken('')
  accessRevoked.value = false
  keepCopyOnlyFor(ownerKey(member.value))
}

async function postJson(path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.message || 'Login failed')
  }
  return data.data
}

function clearSession() {
  token.value = ''
  member.value = null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(MEMBER_KEY)
}

// Leaving on purpose takes the downloaded copy along
async function endSessionForGood() {
  clearSession()
  setExpiredToken('')
  await wipeCopy()
}

// A copy with no session behind it, not even an expired one, has nobody to be shown to and
// could never learn of a revocation. It happens if a logout in one tab races a download in another.
async function readCopy() {
  if (!token.value && !expiredToken.value) {
    await wipeCopy()
    return null
  }
  return readSnapshot()
}

// null when the server can't be asked
async function fetchSessionState(value) {
  try {
    const { body } = await fetchJson(`${API_BASE_URL}/api/auth/session-state`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${value}` },
    })
    return body?.data?.state ?? null
  } catch (exception) {
    if (exception instanceof ConnectionError) return null
    throw exception
  }
}

async function revokeAccess() {
  await endSessionForGood()
  accessRevoked.value = true
}

// A 401 can mean the 24h simply ran out, which must not cost a phone at a show its setlist. Only
// a clear "revoked" deletes the copy; if the server can't be reached the copy stays.
async function classifyUnauthorized() {
  const current = token.value
  if (!current) return expiredToken.value ? 'expired' : 'revoked'

  const state = await fetchSessionState(current)
  if (state === 'revoked') {
    await revokeAccess()
    return 'revoked'
  }
  setExpiredToken(current)
  clearSession()
  return 'expired'
}

// Several requests of one screen tend to fail together
function handleUnauthorized() {
  if (!unauthorizedCheck) {
    unauthorizedCheck = classifyUnauthorized().finally(() => {
      unauthorizedCheck = null
    })
  }
  return unauthorizedCheck
}

async function syncCopy(options = {}) {
  if (!token.value || !member.value) return 'no-session'
  const result = await syncSnapshot({
    url: `${API_BASE_URL}/api/offline/snapshot`,
    owner: ownerKey(member.value),
    authHeader: { Authorization: `Bearer ${token.value}` },
    ...options,
  })
  if (result === 'unauthorized') await handleUnauthorized()
  return result
}

// After a change is saved, so the copy on this phone reflects it
function scheduleCopySync() {
  clearTimeout(copySyncTimer)
  copySyncTimer = setTimeout(() => syncCopy({ force: true }), COPY_SYNC_DELAY_MS)
}

export function useAuth() {
  const isLoggedIn = computed(() => !!token.value && !!member.value)
  const sessionExpired = computed(() => !token.value && !!expiredToken.value)

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
      storeSession(data.data)
      return data.data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Central host: returns { code, band } for a single band, or { bands } to choose from
  async function centralLogin(credential, band) {
    loading.value = true
    try {
      return await postJson('/api/auth/central/google', { credential, band })
    } finally {
      loading.value = false
    }
  }

  // Band host: trade the one-time code from the central login for a session
  async function exchangeLoginCode(code) {
    loading.value = true
    try {
      const data = await postJson('/api/auth/central/exchange', { code })
      storeSession(data)
      return data
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    loading.value = true
    error.value = ''

    try {
      if (token.value) {
        await fetchJson(`${API_BASE_URL}/api/auth/logout`, {
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
      await endSessionForGood()
      loading.value = false
    }
  }

  async function logoutAll() {
    loading.value = true
    error.value = ''

    try {
      if (token.value) {
        await fetchJson(`${API_BASE_URL}/api/auth/logout/all`, {
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
      await endSessionForGood()
      loading.value = false
    }
  }

  // Only a real 401 ends the session: with no answer from the server, the person is
  // still whoever they were last time
  async function getCurrentUser() {
    if (!token.value) {
      return null
    }

    let response
    try {
      response = await fetchJson(`${API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.value}`,
        },
      })
    } catch (err) {
      if (err instanceof ConnectionError) return member.value
      throw err
    }

    if (response.status === 401) {
      await handleUnauthorized()
      return null
    }
    if (!response.ok) return member.value

    const data = response.body?.data
    if (data) {
      member.value = {
        id: data.memberId,
        name: data.name,
        email: data.email,
        superAdmin: Boolean(data.superAdminId),
      }
      localStorage.setItem(MEMBER_KEY, JSON.stringify(member.value))
    }
    return data
  }

  // In the background of screens already showing the copy; also notices access taken away
  // from a session that had already run out
  async function revalidateSession() {
    if (token.value) return getCurrentUser()
    if (expiredToken.value && (await fetchSessionState(expiredToken.value)) === 'revoked') {
      await revokeAccess()
    }
    return null
  }

  function getAuthHeader() {
    return token.value ? { Authorization: `Bearer ${token.value}` } : {}
  }

  return {
    token: computed(() => token.value),
    member: computed(() => member.value),
    isLoggedIn,
    sessionExpired,
    loading,
    error,
    clearSession,
    loginWithGoogle,
    centralLogin,
    exchangeLoginCode,
    logout,
    logoutAll,
    getCurrentUser,
    revalidateSession,
    readCopy,
    handleUnauthorized,
    syncCopy,
    scheduleCopySync,
    getAuthHeader,
  }
}
