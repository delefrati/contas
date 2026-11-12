import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A service worker registration and container just real enough to fire their events
class FakeTarget {
  constructor() {
    this.listeners = {}
  }

  addEventListener(type, listener) {
    ;(this.listeners[type] ||= []).push(listener)
  }

  fire(type) {
    for (const listener of this.listeners[type] || []) listener()
  }
}

function fakeWorker(state = 'installing') {
  const worker = new FakeTarget()
  worker.state = state
  worker.postMessage = vi.fn()
  return worker
}

async function setUp({ controller = {}, waiting = null } = {}) {
  vi.resetModules()
  const container = new FakeTarget()
  container.controller = controller
  vi.stubGlobal('navigator', { serviceWorker: container })
  const location = { reload: vi.fn() }
  vi.stubGlobal('location', location)

  const registration = new FakeTarget()
  registration.waiting = waiting
  registration.installing = null
  registration.update = vi.fn().mockResolvedValue()

  const pwa = await import('./pwa')
  pwa.watchForUpdates(registration)
  return { pwa, container, registration, location }
}

describe('app updates', () => {
  let visibility

  beforeEach(() => {
    visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    visibility.mockRestore()
  })

  it('should offer a version already waiting', async () => {
    const { pwa } = await setUp({ waiting: fakeWorker('installed') })
    expect(pwa.updateReady.value).toBe(true)
  })

  it('should offer a version once it finishes installing', async () => {
    const { pwa, registration } = await setUp()
    expect(pwa.updateReady.value).toBe(false)

    const worker = fakeWorker()
    registration.installing = worker
    registration.fire('updatefound')
    worker.state = 'installed'
    registration.waiting = worker
    worker.fire('statechange')

    expect(pwa.updateReady.value).toBe(true)
  })

  it('should not offer the first install, which is already the latest', async () => {
    const { pwa } = await setUp({ controller: null, waiting: fakeWorker('installed') })
    expect(pwa.updateReady.value).toBe(false)
  })

  it('should look for a new version when the app comes back to the screen', async () => {
    const { registration } = await setUp()
    document.dispatchEvent(new Event('visibilitychange'))
    expect(registration.update).toHaveBeenCalled()
  })

  it('should switch to the waiting version and reload only when asked', async () => {
    const waiting = fakeWorker('installed')
    const { pwa, container, location } = await setUp({ waiting })
    expect(location.reload).not.toHaveBeenCalled()

    pwa.applyUpdate()
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(location.reload).not.toHaveBeenCalled()

    container.fire('controllerchange')
    expect(location.reload).toHaveBeenCalledTimes(1)
  })

  it('should offer a reload when another tab took the update', async () => {
    const { pwa, container, location } = await setUp()
    container.fire('controllerchange')
    expect(pwa.updateReady.value).toBe(true)
    expect(location.reload).not.toHaveBeenCalled()

    pwa.applyUpdate()
    expect(location.reload).toHaveBeenCalledTimes(1)
  })
})
