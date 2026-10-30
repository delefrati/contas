// Keeps the screen on between start() and stop(). Browsers drop the lock whenever the
// page is hidden, so it is asked for again each time the page comes back.
export function useWakeLock() {
  let lock = null
  let pending = null
  let wanted = false

  async function request() {
    if (!wanted || lock || pending || !navigator.wakeLock || document.visibilityState !== 'visible') return
    try {
      pending = navigator.wakeLock.request('screen')
      const acquired = await pending
      if (!wanted) {
        acquired.release()
        return
      }
      lock = acquired
      acquired.addEventListener?.('release', () => {
        if (lock === acquired) lock = null
      })
    } catch {
      // Refused (battery saver, no HTTPS...): the screen just keeps its usual timeout
    } finally {
      pending = null
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') request()
  }

  function start() {
    wanted = true
    document.addEventListener('visibilitychange', onVisibilityChange)
    request()
  }

  function stop() {
    wanted = false
    document.removeEventListener('visibilitychange', onVisibilityChange)
    lock?.release()
    lock = null
  }

  return { start, stop }
}
