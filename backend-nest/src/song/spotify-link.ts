import { BadRequestException } from '@nestjs/common';

// A Spotify track ID is 22 base-62 characters
const TRACK_ID = '[0-9A-Za-z]{22}';
const URI = new RegExp(`^spotify:track:(${TRACK_ID})$`);
// open.spotify.com/track/<id>, with or without a locale path (/intl-pt/) and a ?si= query
const URL = new RegExp(`^https?://open\\.spotify\\.com/(?:intl-[a-z]{2}(?:-[a-z]{2})?/)?track/(${TRACK_ID})(?:[/?#].*)?$`, 'i');

export function spotifyTrackUrl(trackId: string | null): string | null {
  return trackId ? `https://open.spotify.com/track/${trackId}` : null;
}

// The track ID from a link, null for an empty one; anything else is refused with a code the page translates
export function parseSpotifyLink(link: string | null | undefined): string | null {
  const text = String(link ?? '').trim();
  if (!text) return null;
  const match = text.match(URI) || text.match(URL);
  if (!match) {
    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Not a Spotify track link.',
      code: 'INVALID_SPOTIFY_LINK',
    });
  }
  return match[1];
}
