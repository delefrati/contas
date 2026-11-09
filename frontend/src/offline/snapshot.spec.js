import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectionLost } from './connection'
import {
  MAX_COPY_AGE_MS,
  copyInfo,
  keepCopyOnlyFor,
  readSnapshot,
  syncSnapshot,
  wipeCopy,
} from './snapshot'

const data = { window: { from: '2026-10-01', to: '2027-11-09' }, events: [{ id: 5 }], songs: [] }
const request = { url: '/api/offline/snapshot', owner: 'm:1', authHeader: {} }

function answer(body = { data }, status = 200) {
  return { ok: status < 400, status, json: async () => body }
}

describe('snapshot', () => {
  beforeEach(async () => {
    await wipeCopy()
    connectionLost.value = false
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stores a download and reads it back', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer()))

    await expect(syncSnapshot(request)).resolves.toBe('saved')

    await expect(readSnapshot()).resolves.toEqual(data)
    expect(copyInfo.value.window).toEqual(data.window)
  })

  it('does not download again within the interval unless forced', async () => {
    const fetchMock = vi.fn().mockResolvedValue(answer())
    vi.stubGlobal('fetch', fetchMock)
    await syncSnapshot(request)

    await expect(syncSnapshot(request)).resolves.toBe('fresh')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await expect(syncSnapshot({ ...request, force: true })).resolves.toBe('saved')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the existing copy when a download fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer()))
    await syncSnapshot(request)

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(syncSnapshot({ ...request, force: true })).resolves.toBe('failed')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer({ message: 'boom' }, 500)))
    await expect(syncSnapshot({ ...request, force: true })).resolves.toBe('failed')

    await expect(readSnapshot()).resolves.toEqual(data)
  })

  it('reports an expired session without touching the copy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer()))
    await syncSnapshot(request)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer({ message: 'no' }, 401)))

    await expect(syncSnapshot({ ...request, force: true })).resolves.toBe('unauthorized')
    await expect(readSnapshot()).resolves.toEqual(data)
  })

  it('does not bring data back when a wipe happens during the download', async () => {
    let finish
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { finish = resolve })))

    const pending = syncSnapshot({ ...request, force: true })
    await vi.waitFor(() => expect(finish).toBeDefined())
    await wipeCopy()
    finish(answer())

    await expect(pending).resolves.toBe('failed')
    await expect(readSnapshot()).resolves.toBeNull()
  })

  it('throws away a copy older than the limit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer()))
    await syncSnapshot(request)

    await expect(readSnapshot(Date.now() + MAX_COPY_AGE_MS - 60_000)).resolves.toEqual(data)
    await expect(readSnapshot(Date.now() + MAX_COPY_AGE_MS + 60_000)).resolves.toBeNull()
    await expect(readSnapshot()).resolves.toBeNull()
    expect(copyInfo.value).toBeNull()
  })

  it('wipes the copy when someone else signs in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer()))
    await syncSnapshot(request)

    await keepCopyOnlyFor('m:1')
    await expect(readSnapshot()).resolves.toEqual(data)

    await keepCopyOnlyFor('m:2')
    await expect(readSnapshot()).resolves.toBeNull()
  })
})
