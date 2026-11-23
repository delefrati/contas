import { describe, it, expect } from 'vitest'
import { isSpotifyLink } from './spotify'

const id = '4uLU6hMCjMI75M1A2tKUQC'

describe('isSpotifyLink', () => {
  it.each([
    '',
    '  ',
    `https://open.spotify.com/track/${id}`,
    `https://open.spotify.com/track/${id}?si=1a2b3c`,
    `https://open.spotify.com/intl-pt/track/${id}`,
    ` spotify:track:${id} `,
  ])('accepts %j', (link) => {
    expect(isSpotifyLink(link)).toBe(true)
  })

  it.each([
    `https://open.spotify.com/album/${id}`,
    `https://open.spotify.com/playlist/${id}`,
    `spotify:artist:${id}`,
    `https://example.com/track/${id}`,
    'https://open.spotify.com/track/curto',
    'Exagerado',
  ])('refuses %j', (link) => {
    expect(isSpotifyLink(link)).toBe(false)
  })
})
