import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConnectionError, connectionLost, fetchJson } from './connection'

describe('fetchJson', () => {
  beforeEach(() => {
    connectionLost.value = false
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns the parsed answer and marks the connection as working', async () => {
    connectionLost.value = true
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'no' }) }))

    await expect(fetchJson('/api/x')).resolves.toEqual({ ok: false, status: 401, body: { message: 'no' } })
    expect(connectionLost.value).toBe(false)
  })

  it('treats a page that is not JSON as no connection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => { throw new SyntaxError('<html>') },
    }))

    await expect(fetchJson('/api/x')).rejects.toBeInstanceOf(ConnectionError)
    expect(connectionLost.value).toBe(true)
  })

  it('gives up without trying when the phone knows it is offline', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    await expect(fetchJson('/api/x')).rejects.toBeInstanceOf(ConnectionError)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(connectionLost.value).toBe(true)
  })

  it('gives up on a body that stalls after the headers arrive', async () => {
    vi.useFakeTimers()
    let signal
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      signal = options.signal
      return {
        ok: true,
        status: 200,
        json: () => new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')))
        }),
      }
    }))

    const result = fetchJson('/api/x', {}, 1000)
    const assertion = expect(result).rejects.toBeInstanceOf(ConnectionError)
    await vi.advanceTimersByTimeAsync(1000)

    await assertion
    expect(signal.aborted).toBe(true)
  })
})
