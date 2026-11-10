import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// The real router and guard, with the band, the session and the host faked
const host = vi.hoisted(() => ({ central: false, slug: 'banda' }))
const auth = vi.hoisted(() => ({ calls: 0 }))
const loadBand = vi.hoisted(() => vi.fn())

vi.mock('../hosts', async (importOriginal) => ({
  ...(await importOriginal()),
  isCentralHost: () => host.central,
  currentBandSlug: () => (host.central ? null : host.slug),
}))

vi.mock('../composables/useBand', () => ({
  loadBand,
  useBand: () => ({ band: ref(null), logoUrl: ref(null), setBand: vi.fn() }),
}))

vi.mock('../composables/useAuth', () => ({
  useAuth: () => {
    auth.calls += 1
    return {
      isLoggedIn: ref(false),
      token: ref(''),
      member: ref(null),
      sessionExpired: ref(false),
      getCurrentUser: vi.fn().mockResolvedValue(null),
      readCopy: vi.fn().mockResolvedValue(null),
      revalidateSession: vi.fn().mockResolvedValue(),
      syncCopy: vi.fn(),
    }
  },
}))

async function freshRouter() {
  vi.resetModules()
  const { default: router } = await import('./index.js')
  return router
}

describe('router: unknown addresses', () => {
  beforeEach(() => {
    host.central = false
    host.slug = 'banda'
    auth.calls = 0
    // As without a connection: the band never answers
    loadBand.mockReset().mockReturnValue(new Promise(() => {}))
  })

  it('shows the not found page signed out, without waiting for the band or the session', async () => {
    const router = await freshRouter()
    auth.calls = 0
    await router.push('/nao-existe/mesmo')
    expect(router.currentRoute.value.name).toBe('NotFound')
    expect(router.currentRoute.value.fullPath).toBe('/nao-existe/mesmo')
    expect(loadBand).not.toHaveBeenCalled()
    expect(auth.calls).toBe(0)
  })

  it('covers malformed ids on known screens', async () => {
    const router = await freshRouter()
    await router.push('/agenda/abc')
    expect(router.currentRoute.value.name).toBe('NotFound')
  })

  it('shows on the central host too, while known screens still go to the login', async () => {
    host.central = true
    const router = await freshRouter()
    await router.push('/qualquer-coisa')
    expect(router.currentRoute.value.name).toBe('NotFound')

    await router.push('/agenda')
    expect(router.currentRoute.value.name).toBe('CentralLogin')
  })

  it('keeps the old songs address as a redirect', async () => {
    host.slug = null
    const router = await freshRouter()
    await router.push('/repertorio')
    expect(router.currentRoute.value.name).not.toBe('NotFound')
  })
})
