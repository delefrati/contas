const STAGE_POSITION_KEY = 'stage_view_position'
// Long enough for a whole show, short enough not to reopen yesterday's
const STAGE_POSITION_MAX_AGE_MS = 8 * 60 * 60 * 1000

export function isStageOpen() {
  return new URLSearchParams(window.location.search).get('visualizar') === '1'
}

export function saveStagePosition(position) {
  try {
    localStorage.setItem(STAGE_POSITION_KEY, JSON.stringify({ ...position, savedAt: Date.now() }))
  } catch {
    // Not remembering the place is fine
  }
}

export function clearStagePosition() {
  try {
    localStorage.removeItem(STAGE_POSITION_KEY)
  } catch {
    // Nothing to clear
  }
}

// Only left behind when the phone killed the app mid-show: closing the view clears it
export function readStagePosition(now = Date.now()) {
  try {
    const position = JSON.parse(localStorage.getItem(STAGE_POSITION_KEY) || 'null')
    if (Number.isInteger(position?.eventId) && now - position.savedAt < STAGE_POSITION_MAX_AGE_MS) {
      return position
    }
  } catch {
    // A corrupt entry is the same as none
  }
  return null
}
