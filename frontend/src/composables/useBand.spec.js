import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadBand({ baseDomain, hostname, response }) {
  vi.resetModules()
  vi.stubEnv('VITE_BASE_DOMAIN', baseDomain)
  const location = { hostname, replace: vi.fn() }
  vi.stubGlobal('location', location)
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)

  const { useBand } = await import('./useBand')
  const { band } = useBand()
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
  await new Promise((resolve) => setTimeout(resolve))
  return { band, location }
}

describe('useBand', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('loads the band of the current subdomain', async () => {
    const data = { id: 1, slug: 'maverick', name: 'Maverick' }
    const { band, location } = await loadBand({
      baseDomain: 'minhabanda.com',
      hostname: 'maverick.minhabanda.com',
      response: { ok: true, status: 200, json: async () => ({ data }) },
    })

    expect(band.value).toEqual(data)
    expect(location.replace).not.toHaveBeenCalled()
  })

  it('sends a subdomain without a band to the central host', async () => {
    const { band, location } = await loadBand({
      baseDomain: 'minhabanda.com',
      hostname: 'xyz.minhabanda.com',
      response: { ok: false, status: 404, json: async () => ({ message: 'Band not found' }) },
    })

    expect(location.replace).toHaveBeenCalledWith('https://minhabanda.com/')
    expect(band.value).toBeNull()
  })

  it('tells the router when the subdomain has no band', async () => {
    await loadBand({
      baseDomain: 'minhabanda.com',
      hostname: 'xyz.minhabanda.com',
      response: { ok: false, status: 404, json: async () => ({ message: 'Band not found' }) },
    })

    const useBandModule = await import('./useBand')
    await expect(useBandModule.loadBand()).resolves.toBe(false)
  })

  it('stays on the page when the API is failing', async () => {
    const { location } = await loadBand({
      baseDomain: 'minhabanda.com',
      hostname: 'maverick.minhabanda.com',
      response: { ok: false, status: 502 },
    })

    expect(location.replace).not.toHaveBeenCalled()
  })

  it('stays when a 404 did not come from our server', async () => {
    const { location } = await loadBand({
      baseDomain: 'minhabanda.com',
      hostname: 'maverick.minhabanda.com',
      response: { ok: false, status: 404, json: async () => { throw new SyntaxError('<html>') } },
    })

    expect(location.replace).not.toHaveBeenCalled()
  })

  it('never redirects in local development', async () => {
    const { location } = await loadBand({
      baseDomain: '',
      hostname: 'localhost',
      response: { ok: false, status: 404, json: async () => ({ message: 'Band not found' }) },
    })

    expect(location.replace).not.toHaveBeenCalled()
  })
})
