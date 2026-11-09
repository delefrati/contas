import { ref } from 'vue'

// Set from what requests actually do: navigator.onLine is true on a venue's dead Wi-Fi
export const connectionLost = ref(false)

export class ConnectionError extends Error {}

// GETs and POSTs to our API that must never hang the app on a bad signal. The timer also covers
// the body, which can stall after the headers arrive. Anything that isn't JSON (a Wi-Fi login
// page, a gateway error) didn't come from our server, so it counts as no connection.
export async function fetchJson(url, options = {}, timeoutMs = 5000) {
  if (navigator.onLine === false) {
    connectionLost.value = true
    throw new ConnectionError('offline')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const body = await response.json()
    connectionLost.value = false
    return { status: response.status, ok: response.ok, body }
  } catch {
    connectionLost.value = true
    throw new ConnectionError('no connection')
  } finally {
    clearTimeout(timer)
  }
}
