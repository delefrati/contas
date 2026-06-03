import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: () => { store = {} },
  }
})()
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

// We need to reset module state between tests
let useAuth

describe('useAuth', () => {
  beforeEach(async () => {
    vi.resetModules()
    localStorageMock.clear()
    mockFetch.mockReset()
    const mod = await import('./useAuth.js')
    useAuth = mod.useAuth
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('should start as not logged in when no token in localStorage', () => {
      const { isLoggedIn, token, member } = useAuth()
      expect(isLoggedIn.value).toBe(false)
      expect(token.value).toBe('')
      expect(member.value).toBeNull()
    })
  })

  describe('loginWithGoogle', () => {
    it('should store token and member on successful login', async () => {
      const mockResponse = {
        data: {
          token: 'jwt-token-123',
          member: { id: 1, name: 'Test User', email: 'test@test.com' },
        },
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const { loginWithGoogle, isLoggedIn, token, member } = useAuth()
      await loginWithGoogle('google-credential')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login/google'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ credential: 'google-credential' }),
        }),
      )
      expect(token.value).toBe('jwt-token-123')
      expect(member.value).toEqual(mockResponse.data.member)
      expect(isLoggedIn.value).toBe(true)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'jwt-token-123')
    })

    it('should throw error on failed login', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Member not found' }),
      })

      const { loginWithGoogle, error } = useAuth()
      await expect(loginWithGoogle('bad-token')).rejects.toThrow('Member not found')
      expect(error.value).toBe('Member not found')
    })
  })

  describe('logout', () => {
    it('should clear token and member from state and localStorage', async () => {
      // First login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { token: 'tk', member: { id: 1, name: 'T' } },
        }),
      })
      const { loginWithGoogle, logout, isLoggedIn } = useAuth()
      await loginWithGoogle('cred')

      // Then logout
      mockFetch.mockResolvedValueOnce({ ok: true })
      await logout()

      expect(isLoggedIn.value).toBe(false)
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_member')
    })

    it('should clear state even if API call fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { token: 'tk', member: { id: 1, name: 'T' } },
        }),
      })
      const { loginWithGoogle, logout, isLoggedIn } = useAuth()
      await loginWithGoogle('cred')

      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      await logout()

      expect(isLoggedIn.value).toBe(false)
    })
  })

  describe('logoutAll', () => {
    it('should clear state after logout all', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { token: 'tk', member: { id: 1, name: 'T' } },
        }),
      })
      const { loginWithGoogle, logoutAll, isLoggedIn } = useAuth()
      await loginWithGoogle('cred')

      mockFetch.mockResolvedValueOnce({ ok: true })
      await logoutAll()

      expect(isLoggedIn.value).toBe(false)
    })
  })

  describe('getCurrentUser', () => {
    it('should return null when no token', async () => {
      const { getCurrentUser } = useAuth()
      const result = await getCurrentUser()
      expect(result).toBeNull()
    })

    it('should return user data on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { token: 'tk', member: { id: 1, name: 'T' } },
        }),
      })
      const { loginWithGoogle, getCurrentUser } = useAuth()
      await loginWithGoogle('cred')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { memberId: 1, name: 'T' } }),
      })
      const result = await getCurrentUser()
      expect(result).toEqual({ memberId: 1, name: 'T' })
    })

    it('should clear token on 401 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { token: 'tk', member: { id: 1, name: 'T' } },
        }),
      })
      const { loginWithGoogle, getCurrentUser, isLoggedIn } = useAuth()
      await loginWithGoogle('cred')

      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
      await getCurrentUser()

      expect(isLoggedIn.value).toBe(false)
    })
  })

  describe('getAuthHeader', () => {
    it('should return empty object when no token', () => {
      const { getAuthHeader } = useAuth()
      expect(getAuthHeader()).toEqual({})
    })

    it('should return Authorization header when token exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { token: 'my-token', member: { id: 1, name: 'T' } },
        }),
      })
      const { loginWithGoogle, getAuthHeader } = useAuth()
      await loginWithGoogle('cred')

      expect(getAuthHeader()).toEqual({ Authorization: 'Bearer my-token' })
    })
  })
})
