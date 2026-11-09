import { computed, ref } from 'vue'
import { centralUrl, currentBandSlug, isCentralHost } from '../hosts'
import { fetchJson } from '../offline/connection'
import { readSnapshot, wipeCopy } from '../offline/snapshot'
import { isStageOpen } from '../offline/stage'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

// Current band, resolved by the backend from the subdomain (e.g. maverick.minhabanda.com)
const band = ref(null)
let request = null

async function fetchBand() {
  try {
    const response = await fetchJson(`${API_BASE_URL}/api/band`)
    // Every subdomain reaches the app, including ones no active band uses
    if (response.status === 404 && currentBandSlug()) {
      // Also how a disabled band shows up: its copy goes, but never in the middle of a show
      await wipeCopy()
      if (isStageOpen()) return true
      window.location.replace(centralUrl())
      return false
    }
    if (response.ok) band.value = response.body?.data ?? null
  } catch {
    // Without a connection the downloaded copy still knows the name and logo
    const snapshot = await readSnapshot()
    if (snapshot) band.value = snapshot.band
  }
  return true
}

// Resolves to false when this subdomain has no active band: the browser is already leaving it
export function loadBand() {
  if (!request) request = fetchBand()
  return request
}

// The API returns a path that changes on every upload, so browsers never show a stale logo
const logoUrl = computed(() => (band.value?.logoUrl ? `${API_BASE_URL}${band.value.logoUrl}` : null))

export function useBand() {
  // The central login host isn't a band
  if (!isCentralHost()) loadBand()

  // After uploading or removing the logo, the endpoint answers with the updated band
  function setBand(updated) {
    band.value = updated
  }

  return { band, logoUrl, setBand }
}
