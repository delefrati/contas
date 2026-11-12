import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import { loadBand, useBand } from '../composables/useBand'
import { isCentralHost } from '../hosts'
import { ConnectionError, fetchJson } from './connection'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

// Finds out whether the server is back, and brings session and copy up to date if so
export async function checkConnection() {
  try {
    await fetchJson(`${API_BASE_URL}/api/health`)
  } catch (exception) {
    if (exception instanceof ConnectionError) return
    throw exception
  }
  const { revalidateSession, syncCopy } = useAuth()
  await revalidateSession()
  await syncCopy()
}

function addToHead(tag, attributes) {
  const element = document.createElement(tag)
  Object.assign(element, attributes)
  document.head.appendChild(element)
}

// Injected here and not in index.html: the same build serves the central host and
// unknown subdomains, neither of which should offer to be installed
function declareInstallable() {
  addToHead('link', { rel: 'manifest', href: '/manifest.webmanifest' })
  addToHead('link', { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' })
  addToHead('meta', { name: 'theme-color', content: '#1a202c' })
  addToHead('meta', { name: 'mobile-web-app-capable', content: 'yes' })
  addToHead('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' })
  addToHead('meta', { name: 'apple-mobile-web-app-title', content: 'minhabanda' })
}

// A new version of the app is installed and waiting. It takes over when the app is closed and
// reopened, or when the person asks with applyUpdate (UpdateBar): nothing may reload the page
// on its own, because that could happen in the middle of a show.
export const updateReady = ref(false)

let registration = null
let reloading = false

function reload() {
  if (reloading) return
  reloading = true
  window.location.reload()
}

export function watchForUpdates(reg) {
  registration = reg
  // Without a controller this is the first install, which is already the latest version
  const offerIfWaiting = () => {
    if (reg.waiting && navigator.serviceWorker.controller) updateReady.value = true
  }
  offerIfWaiting()
  reg.addEventListener('updatefound', () => {
    const worker = reg.installing
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed') offerIfWaiting()
    })
  })
  // Another tab took the update: this one keeps running the old version until it reloads
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading) updateReady.value = true
  })
  // An app left open in the background never navigates, so the browser wouldn't look for one
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reg.update().catch(() => {})
  })
}

// The waiting version takes over (sw.js answers SKIP_WAITING) and the page reloads into it
export function applyUpdate() {
  const waiting = registration?.waiting
  if (!waiting) {
    reload()
    return
  }
  navigator.serviceWorker.addEventListener('controllerchange', reload)
  waiting.postMessage({ type: 'SKIP_WAITING' })
}

async function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const { band } = useBand()
  await loadBand()
  if (!band.value) return

  declareInstallable()
  const reg = await navigator.serviceWorker.register('/sw.js').catch(() => null)
  if (reg) watchForUpdates(reg)
}

export function startOfflineSupport() {
  if (isCentralHost()) return

  window.addEventListener('online', checkConnection)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkConnection()
  })
  registerServiceWorker()
}
