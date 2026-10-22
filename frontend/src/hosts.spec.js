import { describe, it, expect, vi, afterEach } from 'vitest'

async function loadHosts(baseDomain) {
  vi.resetModules()
  vi.stubEnv('VITE_BASE_DOMAIN', baseDomain)
  return import('./hosts')
}

describe('hosts', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('without VITE_BASE_DOMAIN (local development)', () => {
    it('should log in directly on the current host', async () => {
      const hosts = await loadHosts('')
      expect(hosts.isCentralHost('localhost')).toBe(false)
      expect(hosts.currentBandSlug('localhost')).toBeNull()
    })
  })

  describe('with VITE_BASE_DOMAIN', () => {
    it('should recognise the central login host', async () => {
      const hosts = await loadHosts('minhabanda.com')
      expect(hosts.isCentralHost('minhabanda.com')).toBe(true)
      expect(hosts.isCentralHost('maverick.minhabanda.com')).toBe(false)
    })

    it('should read the band slug from its subdomain', async () => {
      const hosts = await loadHosts('minhabanda.com')
      expect(hosts.currentBandSlug('maverick.minhabanda.com')).toBe('maverick')
      expect(hosts.currentBandSlug('minhabanda.com')).toBeNull()
      expect(hosts.currentBandSlug('maverick.evil.com')).toBeNull()
    })

    it('should build the band callback URL with the code', async () => {
      const hosts = await loadHosts('minhabanda.com')
      expect(hosts.bandCallbackUrl('maverick', 'abc', '/repertorio')).toBe(
        'https://maverick.minhabanda.com/auth/callback?code=abc&redirect=%2Frepertorio',
      )
    })
  })

  describe('safeRedirectPath', () => {
    it('should keep same-site paths', async () => {
      const { safeRedirectPath } = await loadHosts('')
      expect(safeRedirectPath('/repertorio')).toBe('/repertorio')
    })

    it('should reject other sites and fall back to the dashboard', async () => {
      const { safeRedirectPath } = await loadHosts('')
      expect(safeRedirectPath('//evil.com')).toBe('/dashboard')
      expect(safeRedirectPath('/\\evil.com')).toBe('/dashboard')
      expect(safeRedirectPath('https://evil.com')).toBe('/dashboard')
      expect(safeRedirectPath(undefined)).toBe('/dashboard')
    })
  })
})
