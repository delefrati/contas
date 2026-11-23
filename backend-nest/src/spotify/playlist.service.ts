import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { RequestContextService } from '../common/request-context.service';
import { SpotifyService } from './spotify.service';
import {
  MAX_ITEMS_PER_REQUEST,
  SpotifyRequestError,
  SpotifyTrackDto,
  addItems,
  createPlaylist,
  renamePlaylist,
  replaceItems,
  searchTracks,
  trackUri,
} from './spotify-api';

export interface PlaylistResultDto {
  url: string;
  // Songs in the playlist, and songs left out for having no Spotify link
  tracks: number;
  missing: number;
}

const DESCRIPTION = 'Feito no minhabanda.com';

// A refusal the page can translate: the code names the case, the message stays for logs
function playlistError(exception: new (body: object) => HttpException, message: string, code: string): HttpException {
  return new exception({ message, code });
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

// Words a member types to search: Spotify allows a long q, a person never needs one
const MAX_TYPED_SEARCH = 200;

// A value inside a Spotify field filter: its own quotes would end the filter early
function filterValue(text: string): string {
  return `"${text.replace(/"/g, ' ').replace(/\s+/g, ' ').trim()}"`;
}

// "2026-12-12" as "12/12/2026"
function brazilianDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

@Injectable()
export class PlaylistService {
  private readonly logger = new Logger(PlaylistService.name);

  constructor(
    private prisma: PrismaService,
    private logService: LogService,
    private requestContext: RequestContextService,
    private spotifyService: SpotifyService,
  ) {}

  // All the band's songs, in the list's order
  async makeForSongs(): Promise<PlaylistResultDto> {
    const bandId = this.requestContext.requireBandId();
    const band = await this.prisma.band.findUniqueOrThrow({ where: { id: bandId } });
    const songs = await this.prisma.song.findMany({
      where: { bandId, deletedAt: null },
      orderBy: { title: 'asc' },
      select: { spotifyTrackId: true },
    });

    const result = await this.sync(
      band.spotifyPlaylistId,
      `${band.name} · Repertório`,
      songs.map((s) => s.spotifyTrackId),
    );
    if (result.playlistId !== band.spotifyPlaylistId) {
      await this.prisma.band.update({ where: { id: bandId }, data: { spotifyPlaylistId: result.playlistId } });
    }

    await this.logService.log(result.created ? 'CREATE' : 'UPDATE', 'spotify_playlist', undefined, {
      of: 'songs',
      tracks: result.tracks,
      missing: result.missing,
    });
    return { url: result.url, tracks: result.tracks, missing: result.missing };
  }

  // An event's setlist, in its order, without the pauses. The name has only the band and the
  // date: the playlist is public, and an event's title or place can be private (MB-14).
  async makeForEvent(eventId: number): Promise<PlaylistResultDto> {
    const bandId = this.requestContext.requireBandId();
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, bandId, deletedAt: null },
      include: {
        band: true,
        setlist: { orderBy: { position: 'asc' }, include: { song: { select: { spotifyTrackId: true } } } },
      },
    });
    if (!event) throw new NotFoundException('Event not found.');

    const songs = event.setlist.filter((entry) => entry.type === 'song');
    const result = await this.sync(
      event.spotifyPlaylistId,
      `${event.band.name} · ${brazilianDate(event.date)}`,
      songs.map((entry) => entry.song?.spotifyTrackId ?? null),
    );
    if (result.playlistId !== event.spotifyPlaylistId) {
      await this.prisma.event.update({ where: { id: event.id }, data: { spotifyPlaylistId: result.playlistId } });
    }

    await this.logService.log(result.created ? 'CREATE' : 'UPDATE', 'spotify_playlist', event.id, {
      of: 'event',
      tracks: result.tracks,
      missing: result.missing,
    });
    return { url: result.url, tracks: result.tracks, missing: result.missing };
  }

  // Tracks that may be the version a song of the band is, for a member to pick (MB-15). Nothing
  // is saved here: the pick goes through the song update. Words typed by the member replace the
  // song's title and artist.
  async searchForSong(songId: number, typed?: string): Promise<SpotifyTrackDto[]> {
    const song = await this.prisma.song.findFirst({
      where: { id: songId, bandId: this.requestContext.requireBandId(), deletedAt: null },
      select: { title: true, artist: true },
    });
    if (!song) throw new NotFoundException('Song not found.');

    const accessToken = await this.accessToken();
    const words = (typed ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TYPED_SEARCH);
    if (words) {
      try {
        return await searchTracks(accessToken, words);
      } catch (error) {
        throw this.spotifyError(error);
      }
    }
    const filtered = `track:${filterValue(song.title)}${song.artist ? ` artist:${filterValue(song.artist)}` : ''}`;
    try {
      const tracks = await searchTracks(accessToken, filtered);
      if (tracks.length > 0) return tracks;
      // The filters want the exact words; plain words forgive a title written a little differently
      return await searchTracks(accessToken, [song.title, song.artist].filter(Boolean).join(' '));
    } catch (error) {
      throw this.spotifyError(error);
    }
  }

  // Puts these tracks, in order, in the stored playlist, or in a new one when there is none or
  // Spotify no longer finds it
  private async sync(storedId: string | null, name: string, trackIds: (string | null)[]) {
    const uris = trackIds.filter((id): id is string => !!id).map(trackUri);
    const missing = trackIds.length - uris.length;
    if (uris.length === 0) {
      throw playlistError(BadRequestException, 'No song has a Spotify link.', 'NO_SPOTIFY_SONGS');
    }

    const accessToken = await this.accessToken();
    const [first, ...rest] = chunks(uris, MAX_ITEMS_PER_REQUEST);

    try {
      let playlistId = storedId;
      let url = storedId ? `https://open.spotify.com/playlist/${storedId}` : '';
      let created = false;

      if (playlistId) {
        try {
          await replaceItems(accessToken, playlistId, first);
          // The band's name, or the event's date, may have changed since
          await renamePlaylist(accessToken, playlistId, name);
        } catch (error) {
          if (!(error instanceof SpotifyRequestError) || error.status !== 404) throw error;
          playlistId = null;
        }
      }

      if (!playlistId) {
        const playlist = await createPlaylist(accessToken, name, DESCRIPTION);
        playlistId = playlist.id;
        url = playlist.url;
        created = true;
        await addItems(accessToken, playlistId, first);
      }

      for (const batch of rest) await addItems(accessToken, playlistId, batch);

      return { playlistId, url, created, tracks: uris.length, missing };
    } catch (error) {
      throw this.spotifyError(error);
    }
  }

  private async accessToken(): Promise<string> {
    let token: string | null;
    try {
      token = await this.spotifyService.getAccessToken();
    } catch (error) {
      throw this.spotifyError(error);
    }
    if (!token) {
      throw playlistError(ServiceUnavailableException, 'Spotify is unavailable.', 'SPOTIFY_UNAVAILABLE');
    }
    return token;
  }

  private spotifyError(error: unknown): HttpException {
    if (error instanceof HttpException) return error;
    if (error instanceof SpotifyRequestError && error.status === 429) {
      return new HttpException({ message: 'Spotify asked to wait.', code: 'SPOTIFY_RATE_LIMITED' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    this.logger.error(`Spotify playlist failed: ${(error as Error).message}`);
    return playlistError(BadGatewayException, 'Spotify failed.', 'SPOTIFY_ERROR');
  }
}
