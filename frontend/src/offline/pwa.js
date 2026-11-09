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

// A new version stays waiting until the app is closed and reopened: nothing here may ever
// reload the page, because that could happen in the middle of a show
async function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const { band } = useBand()
  await loadBand()
  if (!band.value) return

  declareInstallable()
  await navigator.serviceWorker.register('/sw.js').catch(() => {})
}

export function startOfflineSupport() {
  if (isCentralHost()) return

  window.addEventListener('online', checkConnection)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkConnection()
  })
  registerServiceWorker()
}
