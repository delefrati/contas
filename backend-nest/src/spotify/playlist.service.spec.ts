import { Test } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { PlaylistService } from './playlist.service';
import { SpotifyService } from './spotify.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { RequestContextService } from '../common/request-context.service';

// A track ID per number, 22 characters like Spotify's
const track = (n: number) => `track${String(n).padStart(17, '0')}`;

function reply(status: number, body: object = {}) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);
}

describe('PlaylistService', () => {
  let service: PlaylistService;
  let prisma: {
    band: { findUniqueOrThrow: jest.Mock; update: jest.Mock };
    song: { findMany: jest.Mock };
    event: { findFirst: jest.Mock; update: jest.Mock };
  };
  let spotifyService: { getAccessToken: jest.Mock };
  let logService: { log: jest.Mock };
  let fetchMock: jest.Mock;
  // Spotify's answers, by "METHOD path"; anything else is a 200
  let answers: Record<string, () => Promise<Response>>;

  const band = { id: 1, name: 'Maverick', spotifyPlaylistId: null };

  function calls() {
    return fetchMock.mock.calls.map(([url, init]) => ({
      call: `${init.method} ${String(url).replace('https://api.spotify.com/v1', '')}`,
      body: init.body ? JSON.parse(init.body) : undefined,
    }));
  }

  function event(setlist: object[], overrides: object = {}) {
    return { id: 7, bandId: 1, date: '2026-12-12', title: 'Casamento Júlia e Pedro', spotifyPlaylistId: null, band, setlist, ...overrides };
  }

  const song = (n: number | null) => ({ type: 'song', song: { spotifyTrackId: n === null ? null : track(n) } });
  const pause = { type: 'pause', song: null };

  beforeEach(async () => {
    prisma = {
      band: { findUniqueOrThrow: jest.fn().mockResolvedValue(band), update: jest.fn() },
      song: { findMany: jest.fn() },
      event: { findFirst: jest.fn(), update: jest.fn() },
    };
    spotifyService = { getAccessToken: jest.fn().mockResolvedValue('access') };
    logService = { log: jest.fn().mockResolvedValue({}) };
    answers = {
      'POST /me/playlists': () => reply(201, { id: 'new-list', external_urls: { spotify: 'https://open.spotify.com/playlist/new-list' } }),
    };
    fetchMock = jest.fn((url: string, init: RequestInit) => {
      const key = `${init.method} ${url.replace('https://api.spotify.com/v1', '')}`;
      return answers[key] ? answers[key]() : reply(200, { snapshot_id: 's' });
    });
    global.fetch = fetchMock;

    const module = await Test.createTestingModule({
      providers: [
        PlaylistService,
        { provide: PrismaService, useValue: prisma },
        { provide: LogService, useValue: logService },
        { provide: SpotifyService, useValue: spotifyService },
        { provide: RequestContextService, useValue: { requireBandId: jest.fn().mockReturnValue(1) } },
      ],
    }).compile();
    service = module.get(PlaylistService);
  });

  describe("an event's setlist", () => {
    it("should keep the setlist's order, leave out pauses and songs without a link, and name it by band and date only", async () => {
      prisma.event.findFirst.mockResolvedValue(event([song(3), pause, song(null), song(1), pause, song(2)]));

      const result = await service.makeForEvent(7);

      expect(prisma.event.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 7, bandId: 1, deletedAt: null } }));
      expect(calls()).toEqual([
        { call: 'POST /me/playlists', body: { name: 'Maverick · 12/12/2026', description: 'Feito no minhabanda.com', public: true } },
        { call: 'POST /playlists/new-list/items', body: { uris: [3, 1, 2].map((n) => `spotify:track:${track(n)}`) } },
      ]);
      expect(JSON.stringify(calls())).not.toContain('Casamento');
      expect(result).toEqual({ url: 'https://open.spotify.com/playlist/new-list', tracks: 3, missing: 1 });
      expect(prisma.event.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { spotifyPlaylistId: 'new-list' } });
      expect(logService.log).toHaveBeenCalledWith('CREATE', 'spotify_playlist', 7, { of: 'event', tracks: 3, missing: 1 });
    });

    it('should replace the tracks of the same playlist when made again', async () => {
      prisma.event.findFirst.mockResolvedValue(event([song(2), song(1)], { spotifyPlaylistId: 'old-list' }));

      const result = await service.makeForEvent(7);

      expect(calls()).toEqual([
        { call: 'PUT /playlists/old-list/items', body: { uris: [2, 1].map((n) => `spotify:track:${track(n)}`) } },
        { call: 'PUT /playlists/old-list', body: { name: 'Maverick · 12/12/2026' } },
      ]);
      expect(result.url).toBe('https://open.spotify.com/playlist/old-list');
      expect(prisma.event.update).not.toHaveBeenCalled();
      expect(logService.log).toHaveBeenCalledWith('UPDATE', 'spotify_playlist', 7, expect.anything());
    });

    it('should make a new playlist when Spotify no longer finds the stored one', async () => {
      prisma.event.findFirst.mockResolvedValue(event([song(1)], { spotifyPlaylistId: 'gone' }));
      answers['PUT /playlists/gone/items'] = () => reply(404, { error: { status: 404, message: 'Not found.' } });

      const result = await service.makeForEvent(7);

      expect(calls().map((c) => c.call)).toEqual(['PUT /playlists/gone/items', 'POST /me/playlists', 'POST /playlists/new-list/items']);
      expect(result.url).toBe('https://open.spotify.com/playlist/new-list');
      expect(prisma.event.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { spotifyPlaylistId: 'new-list' } });
    });

    it('should not find an event of another band', async () => {
      prisma.event.findFirst.mockResolvedValue(null);

      await expect(service.makeForEvent(99)).rejects.toThrow('Event not found.');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should refuse a setlist where no song has a link, without calling Spotify', async () => {
      prisma.event.findFirst.mockResolvedValue(event([song(null), pause]));

      const error = await service.makeForEvent(7).catch((e) => e);

      expect((error as HttpException).getResponse()).toMatchObject({ code: 'NO_SPOTIFY_SONGS' });
      expect(spotifyService.getAccessToken).not.toHaveBeenCalled();
    });
  });

  describe("all the band's songs", () => {
    it('should send 150 songs as 100 and 50, in the list order, named as the repertoire', async () => {
      prisma.song.findMany.mockResolvedValue(Array.from({ length: 150 }, (_, i) => ({ spotifyTrackId: track(i) })));

      const result = await service.makeForSongs();

      expect(prisma.song.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { bandId: 1, deletedAt: null }, orderBy: { title: 'asc' } }),
      );
      const sent = calls();
      expect(sent[0].body.name).toBe('Maverick · Repertório');
      expect(sent.slice(1).map((c) => [c.call, c.body.uris.length])).toEqual([
        ['POST /playlists/new-list/items', 100],
        ['POST /playlists/new-list/items', 50],
      ]);
      expect(sent[2].body.uris[0]).toBe(`spotify:track:${track(100)}`);
      expect(result).toMatchObject({ tracks: 150, missing: 0 });
      expect(prisma.band.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { spotifyPlaylistId: 'new-list' } });
    });

    it('should replace the first 100 and add the rest when made again', async () => {
      prisma.band.findUniqueOrThrow.mockResolvedValue({ ...band, spotifyPlaylistId: 'band-list' });
      prisma.song.findMany.mockResolvedValue(Array.from({ length: 150 }, (_, i) => ({ spotifyTrackId: track(i) })));

      await service.makeForSongs();

      expect(calls().map((c) => [c.call, c.body.uris?.length])).toEqual([
        ['PUT /playlists/band-list/items', 100],
        ['PUT /playlists/band-list', undefined],
        ['POST /playlists/band-list/items', 50],
      ]);
    });
  });

  describe('Spotify failing', () => {
    beforeEach(() => {
      prisma.song.findMany.mockResolvedValue([{ spotifyTrackId: track(1) }]);
    });

    async function failure() {
      const error = (await service.makeForSongs().catch((e) => e)) as HttpException;
      return { status: error.getStatus(), code: (error.getResponse() as { code: string }).code };
    }

    it('should report a 429 as a wait, quota or not', async () => {
      answers['POST /me/playlists'] = () => reply(429, { error: { status: 429, message: 'API rate limit exceeded', reason: 'QUOTA_EXCEEDED' } });

      expect(await failure()).toEqual({ status: 429, code: 'SPOTIFY_RATE_LIMITED' });
      expect(prisma.band.update).not.toHaveBeenCalled();
    });

    it('should say Spotify is unavailable without a working connection', async () => {
      spotifyService.getAccessToken.mockResolvedValue(null);

      expect(await failure()).toEqual({ status: 503, code: 'SPOTIFY_UNAVAILABLE' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should report other Spotify errors, and Spotify being unreachable', async () => {
      answers['POST /me/playlists'] = () => reply(500, { error: { status: 500, message: 'Server error' } });
      expect(await failure()).toEqual({ status: 502, code: 'SPOTIFY_ERROR' });

      spotifyService.getAccessToken.mockRejectedValue(new Error('fetch failed'));
      expect(await failure()).toEqual({ status: 502, code: 'SPOTIFY_ERROR' });
    });
  });
});
