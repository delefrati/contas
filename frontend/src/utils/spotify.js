// The same link forms the API accepts (backend-nest/src/song/spotify-link.ts), checked before saving
const TRACK_ID = '[0-9A-Za-z]{22}'
const URI = new RegExp(`^spotify:track:(${TRACK_ID})$`)
const URL = new RegExp(`^https?://open\\.spotify\\.com/(?:intl-[a-z]{2}(?:-[a-z]{2})?/)?track/(${TRACK_ID})(?:[/?#].*)?$`, 'i')

// True for an empty link (no link) or a Spotify track link
export function isSpotifyLink(link) {
  const text = String(link ?? '').trim()
  return !text || URI.test(text) || URL.test(text)
}

// True for text meant as a link, Spotify's or not, rather than words to search for: a link that
// is not a track still gets the invalid-link message instead of a search
export function looksLikeLink(text) {
  const value = String(text ?? '').trim()
  return /^(https?:\/\/|www\.|spotify:)/i.test(value) || /\bspotify\.(com|link)\//i.test(value) || /^\S+\.[a-z]{2,}\/\S*$/i.test(value)
}
