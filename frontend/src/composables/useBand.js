import { ref } from 'vue'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

// Current band, resolved by the backend from the subdomain (e.g. maverick.minhabanda.com)
const band = ref(null)
let request = null

async function fetchBand() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/band`)
    if (response.ok) {
      const body = await response.json()
      band.value = body.data ?? null
    }
  } catch {
    // Band name is cosmetic; the app works without it
  }
}

export function useBand() {
  if (!request) request = fetchBand()
  return { band }
}
