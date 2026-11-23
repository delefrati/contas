// The same link forms the API accepts (backend-nest/src/song/spotify-link.ts), checked before saving
const TRACK_ID = '[0-9A-Za-z]{22}'
const URI = new RegExp(`^spotify:track:(${TRACK_ID})$`)
const URL = new RegExp(`^https?://open\\.spotify\\.com/(?:intl-[a-z]{2}(?:-[a-z]{2})?/)?track/(${TRACK_ID})(?:[/?#].*)?$`, 'i')

// True for an empty link (no link) or a Spotify track link
export function isSpotifyLink(link) {
  const text = String(link ?? '').trim()
  return !text || URI.test(text) || URL.test(text)
}
