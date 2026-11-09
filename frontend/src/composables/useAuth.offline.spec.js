import { beforeEach, describe, expect, it, vi } from 'vitest'

const snapshot = vi.hoisted(() => ({
  accessRevoked: { value: false },
  readSnapshot: vi.fn(),
  keepCopyOnlyFor: vi.fn(),
  syncSnapshot: vi.fn(),
  wipeCopy: vi.fn(),
}))
vi.mock('../offline/snapshot', () => snapshot)

const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body })
const session = { data: { token: 'tk', member: { id: 1, name: 'T', email: 't@t' } } }

async function loggedIn() {
  vi.resetModules()
  localStorage.clear()
  const fetchMock = vi.fn().mockResolvedValueOnce(json(session))
  vi.stubGlobal('fetch', fetchMock)
  const { useAuth } = await import('./useAuth')
  const auth = useAuth()
  await auth.loginWithGoogle('credential')
  fetchMock.mockReset()
  return { auth, fetchMock }
}

describe('useAuth with a downloaded copy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    snapshot.accessRevoked.value = false
  })

  it('keeps who you are when the server cannot be reached', async () => {
    const { auth, fetchMock } = await loggedIn()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(auth.getCurrentUser()).resolves.toMatchObject({ id: 1 })
    expect(auth.isLoggedIn.value).toBe(true)
    expect(snapshot.wipeCopy).not.toHaveBeenCalled()
  })

  it('keeps the copy when the session merely ran out', async () => {
    const { auth, fetchMock } = await loggedIn()
    fetchMock.mockResolvedValue(json({ data: { state: 'expired' } }))

    await expect(auth.handleUnauthorized()).resolves.toBe('expired')

    expect(auth.isLoggedIn.value).toBe(false)
    expect(auth.sessionExpired.value).toBe(true)
    expect(snapshot.wipeCopy).not.toHaveBeenCalled()
    expect(snapshot.accessRevoked.value).toBe(false)
  })

  it('keeps the copy when the state cannot be checked', async () => {
    const { auth, fetchMock } = await loggedIn()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(auth.handleUnauthorized()).resolves.toBe('expired')

    expect(snapshot.wipeCopy).not.toHaveBeenCalled()
  })

  it('deletes the copy when access was revoked', async () => {
    const { auth, fetchMock } = await loggedIn()
    fetchMock.mockResolvedValue(json({ data: { state: 'revoked' } }))

    await expect(auth.handleUnauthorized()).resolves.toBe('revoked')

    expect(snapshot.wipeCopy).toHaveBeenCalled()
    expect(snapshot.accessRevoked.value).toBe(true)
    expect(auth.sessionExpired.value).toBe(false)
  })

  it('asks the server once when several requests fail together', async () => {
    const { auth, fetchMock } = await loggedIn()
    fetchMock.mockResolvedValue(json({ data: { state: 'expired' } }))

    await Promise.all([auth.handleUnauthorized(), auth.handleUnauthorized()])

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('still notices access taken away after the session ran out', async () => {
    const { auth, fetchMock } = await loggedIn()
    fetchMock.mockResolvedValueOnce(json({ data: { state: 'expired' } }))
    await auth.handleUnauthorized()

    fetchMock.mockResolvedValueOnce(json({ data: { state: 'revoked' } }))
    await auth.revalidateSession()

    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer tk')
    expect(snapshot.wipeCopy).toHaveBeenCalled()
    expect(snapshot.accessRevoked.value).toBe(true)
  })

  it('deletes the copy on logout, even without a connection', async () => {
    const { auth, fetchMock } = await loggedIn()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await auth.logout()

    expect(snapshot.wipeCopy).toHaveBeenCalled()
    expect(auth.isLoggedIn.value).toBe(false)
  })

  it('serves the copy to a live or an expired session', async () => {
    const { auth, fetchMock } = await loggedIn()
    snapshot.readSnapshot.mockResolvedValue('copy')
    await expect(auth.readCopy()).resolves.toBe('copy')

    fetchMock.mockResolvedValue(json({ data: { state: 'expired' } }))
    await auth.handleUnauthorized()

    await expect(auth.readCopy()).resolves.toBe('copy')
    expect(snapshot.wipeCopy).not.toHaveBeenCalled()
  })

  it('deletes a copy with no session behind it instead of showing it', async () => {
    vi.resetModules()
    localStorage.clear()
    const { useAuth } = await import('./useAuth')
    snapshot.readSnapshot.mockResolvedValue('copy')

    await expect(useAuth().readCopy()).resolves.toBeNull()

    expect(snapshot.wipeCopy).toHaveBeenCalled()
    expect(snapshot.readSnapshot).not.toHaveBeenCalled()
  })

  it('only keeps a previous copy for the same person on login', async () => {
    await loggedIn()

    expect(snapshot.keepCopyOnlyFor).toHaveBeenCalledWith('m:1')
  })

  it('handles a 401 from a download like any other', async () => {
    const { auth, fetchMock } = await loggedIn()
    snapshot.syncSnapshot.mockResolvedValue('unauthorized')
    fetchMock.mockResolvedValue(json({ data: { state: 'expired' } }))

    await auth.syncCopy()

    expect(auth.sessionExpired.value).toBe(true)
  })
})
