import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  getAuthHeader: () => ({ Authorization: 'Bearer t' }),
  handleUnauthorized: vi.fn(),
  isLoggedIn: { value: true },
  readCopy: vi.fn(),
}))
const stage = vi.hoisted(() => ({ isStageOpen: vi.fn(() => false) }))
const push = vi.hoisted(() => vi.fn())

vi.mock('./useAuth', () => ({ useAuth: () => auth }))
vi.mock('../offline/stage', () => stage)
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

import { useOfflineCopy } from './useOfflineCopy'

const json = (data, status = 200) => ({ ok: status < 400, status, json: async () => ({ data }) })
const copy = { events: [1] }

function setup(options = {}) {
  const offlineCopy = useOfflineCopy()
  const paint = vi.fn(options.paint)
  const apply = vi.fn(options.apply)
  return { ...offlineCopy, paint, apply, run: () => offlineCopy.load({ paths: ['/api/x'], paint, apply }) }
}

describe('useOfflineCopy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.isLoggedIn.value = true
    stage.isStageOpen.mockReturnValue(false)
    auth.readCopy.mockResolvedValue(copy)
  })

  it('paints the copy, then replaces it with live data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json('live')))
    const { run, paint, apply, showingCopy } = setup()

    await expect(run()).resolves.toBe('live')

    expect(paint).toHaveBeenCalledWith(copy)
    expect(apply).toHaveBeenCalledWith(['live'])
    expect(showingCopy.value).toBe(false)
  })

  it('stays read-only when the live data was held back', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json('live')))
    const { run, showingCopy } = setup({ apply: () => false })

    await expect(run()).resolves.toBe('live')
    expect(showingCopy.value).toBe(true)
  })

  it('stays read-only on the copy without a connection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const { run, apply, showingCopy } = setup()

    await expect(run()).resolves.toBe('copy')

    expect(apply).not.toHaveBeenCalled()
    expect(showingCopy.value).toBe(true)
  })

  it('reports having nothing to show without a connection', async () => {
    auth.readCopy.mockResolvedValue(null)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const { run, showingCopy } = setup()

    await expect(run()).resolves.toBe('offline')
    expect(showingCopy.value).toBe(false)
  })

  it('treats a copy that lacks this screen as nothing to show', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const { run } = setup({ paint: () => false })

    await expect(run()).resolves.toBe('offline')
  })

  it('does not ask the server when the session has already ended', async () => {
    auth.isLoggedIn.value = false
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { run } = setup()

    await expect(run()).resolves.toBe('copy')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps the copy on screen when the session expired', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(null, 401)))
    auth.handleUnauthorized.mockResolvedValue('expired')
    const { run, showingCopy } = setup()

    await expect(run()).resolves.toBe('copy')

    expect(push).not.toHaveBeenCalled()
    expect(showingCopy.value).toBe(true)
  })

  it('goes to login when access was revoked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(null, 401)))
    auth.handleUnauthorized.mockResolvedValue('revoked')
    const { run } = setup()

    await expect(run()).resolves.toBe('redirected')
    expect(push).toHaveBeenCalledWith({ path: '/login', query: { reason: 'expired' } })
  })

  it('does not interrupt the stage view even when access was revoked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(null, 401)))
    auth.handleUnauthorized.mockResolvedValue('revoked')
    stage.isStageOpen.mockReturnValue(true)
    const { run } = setup()

    await expect(run()).resolves.toBe('copy')
    expect(push).not.toHaveBeenCalled()
  })

  it('ignores a load overtaken by a newer one', async () => {
    let finishFirst
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve }))
      .mockResolvedValue(json('second')))
    const { run, apply } = setup()

    const first = run()
    await vi.waitFor(() => expect(finishFirst).toBeDefined())
    await expect(run()).resolves.toBe('live')
    finishFirst(json('first'))

    await expect(first).resolves.toBe('superseded')
    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply).toHaveBeenCalledWith(['second'])
  })
})
