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

describe('router: the manual', () => {
  beforeEach(() => {
    host.central = false
    host.slug = 'banda'
    auth.calls = 0
    // As without a connection: the band never answers
    loadBand.mockReset().mockReturnValue(new Promise(() => {}))
  })

  it('opens signed out on a band, without waiting for the band or the session', async () => {
    const router = await freshRouter()
    auth.calls = 0
    await router.push('/ajuda/agenda')
    expect(router.currentRoute.value.name).toBe('Manual')
    expect(router.currentRoute.value.params.part).toBe('agenda')
    expect(loadBand).not.toHaveBeenCalled()
    expect(auth.calls).toBe(0)
  })

  it('opens on the central host, which otherwise only serves the login', async () => {
    host.central = true
    const router = await freshRouter()
    await router.push('/ajuda/entrar')
    expect(router.currentRoute.value.name).toBe('Manual')

    await router.push('/agenda')
    expect(router.currentRoute.value.name).toBe('CentralLogin')
  })

  it('still sends other screens to the login when signed out', async () => {
    // Locally, where the login is on the same host instead of the central one
    host.slug = null
    const router = await freshRouter()
    await router.push('/registros')
    expect(router.currentRoute.value.name).toBe('Login')
  })
})
