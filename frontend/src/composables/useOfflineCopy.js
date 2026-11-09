import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from './useAuth'
import { ConnectionError, fetchJson } from '../offline/connection'
import { isStageOpen } from '../offline/stage'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

// Loading for the screens that work without internet: the downloaded copy goes up at once, then
// live data replaces it if it arrives. While `showingCopy` is true the screen is read-only,
// because saving on top of an old copy would overwrite newer work.
export function useOfflineCopy() {
  const router = useRouter()
  const { getAuthHeader, handleUnauthorized, isLoggedIn, readCopy } = useAuth()
  const showingCopy = ref(false)
  let latestLoad = 0

  // `paint` may return false when the copy doesn't have what this screen needs, and `apply` when
  // it held the live data back, which leaves the copy on screen.
  // Resolves to live | copy | notFound | offline | failed | redirected | superseded.
  async function load({ paths, paint, apply }) {
    const run = ++latestLoad
    const snapshot = await readCopy()
    if (run !== latestLoad) return 'superseded'

    const painted = Boolean(snapshot) && paint(snapshot) !== false
    showingCopy.value = painted
    if (painted && !isLoggedIn.value) return 'copy'

    let responses
    try {
      responses = await Promise.all(
        paths.map((path) => fetchJson(`${API_BASE_URL}${path}`, { headers: getAuthHeader() })),
      )
    } catch (exception) {
      if (!(exception instanceof ConnectionError)) throw exception
      if (run !== latestLoad) return 'superseded'
      return painted ? 'copy' : 'offline'
    }
    if (run !== latestLoad) return 'superseded'

    if (responses.some((response) => response.status === 401)) {
      const state = await handleUnauthorized()
      if (painted && (state === 'expired' || isStageOpen())) return 'copy'
      await router.push({ path: '/login', query: { reason: 'expired' } })
      return 'redirected'
    }
    if (responses[0].status === 404) {
      showingCopy.value = false
      return 'notFound'
    }
    if (responses.some((response) => !response.ok)) return painted ? 'copy' : 'failed'

    if (apply(responses.map((response) => response.body?.data)) !== false) showingCopy.value = false
    return 'live'
  }

  return { showingCopy, load }
}
