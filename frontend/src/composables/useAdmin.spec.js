import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockFetch = vi.fn()
global.fetch = mockFetch

function reply(status, body) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) }
}

let useAdmin

describe('useAdmin', () => {
  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    mockFetch.mockReset()
    useAdmin = (await import('./useAdmin.js')).useAdmin
  })

  it('should keep the admin session apart from the band session', async () => {
    localStorage.setItem('auth_token', 'band-token')
    mockFetch.mockResolvedValueOnce(reply(200, {
      data: { token: 'admin-token', superAdmin: { id: 3, name: 'Root', email: 'root@test.com' } },
    }))

    const { login, isLoggedIn, admin } = useAdmin()
    await login('google-credential')

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8001/api/admin/auth/google', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ credential: 'google-credential' }),
    }))
    expect(isLoggedIn.value).toBe(true)
    expect(admin.value.name).toBe('Root')
    expect(localStorage.getItem('admin_token')).toBe('admin-token')
    expect(localStorage.getItem('auth_token')).toBe('band-token')
  })

  it('should send the admin token and return the data', async () => {
    localStorage.setItem('admin_token', 'admin-token')
    localStorage.setItem('admin_user', JSON.stringify({ id: 3, name: 'Root' }))
    // The stored session is read when the module loads
    vi.resetModules()
    useAdmin = (await import('./useAdmin.js')).useAdmin
    mockFetch.mockResolvedValueOnce(reply(200, { data: [{ id: 1 }] }))

    const result = await useAdmin().get('/bands')

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8001/api/admin/bands', expect.objectContaining({
      method: 'GET',
      headers: { Authorization: 'Bearer admin-token' },
    }))
    expect(result).toEqual([{ id: 1 }])
  })

  it('should throw the API message on failure', async () => {
    mockFetch.mockResolvedValueOnce(reply(400, { message: 'Address nova is already taken' }))
    await expect(useAdmin().post('/bands', { slug: 'nova' })).rejects.toThrow('Address nova is already taken')
  })

  it('should drop a session the API rejects and flag it as expired', async () => {
    mockFetch.mockResolvedValueOnce(reply(200, {
      data: { token: 'admin-token', superAdmin: { id: 3, name: 'Root', email: 'root@test.com' } },
    }))
    const { login, get, isLoggedIn, expired } = useAdmin()
    await login('google-credential')

    mockFetch.mockResolvedValueOnce(reply(401, { message: 'Unauthorized' }))
    await expect(get('/bands')).rejects.toThrow('Unauthorized')

    expect(isLoggedIn.value).toBe(false)
    expect(expired.value).toBe(true)
    expect(localStorage.getItem('admin_token')).toBeNull()
  })

  it('should not call the API on logout without a session', async () => {
    await useAdmin().logout()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
