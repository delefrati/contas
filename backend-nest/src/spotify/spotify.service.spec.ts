import { Test } from '@nestjs/testing';
import { SpotifyService } from './spotify.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { decryptToken, encryptToken } from './token-crypto';

const KEY = Buffer.alloc(32, 7);
const ENV = {
  SPOTIFY_CLIENT_ID: 'client-id',
  SPOTIFY_CLIENT_SECRET: 'client-secret',
  SPOTIFY_REDIRECT_URI: 'https://minhabanda.com/api/admin/spotify/callback',
  SPOTIFY_TOKEN_KEY: KEY.toString('base64'),
  BASE_DOMAIN: 'minhabanda.com',
  CORS_ORIGIN: 'http://localhost:51731',
};

function reply(status: number, body: object) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);
}

describe('SpotifyService', () => {
  const saved = { ...process.env };
  let prisma: {
    spotifyConnection: { findUnique: jest.Mock; upsert: jest.Mock; update: jest.Mock; deleteMany: jest.Mock };
    superAdmin: { findFirst: jest.Mock };
  };
  let logService: { logPlatform: jest.Mock };
  let fetchMock: jest.Mock;

  async function createService(env: Record<string, string> = ENV): Promise<SpotifyService> {
    process.env = { ...saved, ...env };
    const module = await Test.createTestingModule({
      providers: [
        SpotifyService,
        { provide: PrismaService, useValue: prisma },
        { provide: LogService, useValue: logService },
      ],
    }).compile();
    return module.get(SpotifyService);
  }

  // The state Spotify would send back, from the authorize URL the service built
  function stateOf(url: string): string {
    return new URL(url).searchParams.get('state')!;
  }

  // Spotify's answers to the code exchange and to /me
  function spotifyAccepts(tokens: object = { access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600 }) {
    fetchMock.mockImplementation((url: string) =>
      url.endsWith('/api/token') ? reply(200, tokens) : reply(200, { id: 'minhabanda', display_name: 'minhabanda.com' }),
    );
  }

  beforeEach(() => {
    prisma = {
      spotifyConnection: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      superAdmin: { findFirst: jest.fn().mockResolvedValue({ id: 3, active: true }) },
    };
    logService = { logPlatform: jest.fn().mockResolvedValue(undefined) };
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    process.env = saved;
    jest.useRealTimers();
  });

  describe('not set up', () => {
    it('should say so without reading the database, and refuse to connect', async () => {
      const service = await createService({ ...ENV, SPOTIFY_CLIENT_SECRET: '' });

      expect(await service.status()).toEqual({ configured: false, problem: null, connection: null });
      expect(prisma.spotifyConnection.findUnique).not.toHaveBeenCalled();
      expect(() => service.startConnect(3)).toThrow(/not set up/);
      expect(await service.getAccessToken()).toBeNull();
    });

    it('should report a key of the wrong size instead of failing to start', async () => {
      const service = await createService({ ...ENV, SPOTIFY_TOKEN_KEY: 'short' });

      expect(await service.status()).toMatchObject({ configured: false, problem: expect.stringMatching(/32 bytes/) });
    });
  });

  describe('connecting', () => {
    it('should send the super admin to Spotify asking only for the public playlist scope', async () => {
      const service = await createService();
      const url = new URL(service.startConnect(3, 'https://minhabanda.com'));

      expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
      expect(url.searchParams.get('scope')).toBe('playlist-modify-public');
      expect(url.searchParams.get('redirect_uri')).toBe(ENV.SPOTIFY_REDIRECT_URI);
      expect(url.searchParams.get('state')).toHaveLength(43);
    });

    it('should save the account with its refresh token encrypted, for a good state', async () => {
      const service = await createService();
      const state = stateOf(service.startConnect(3, 'https://minhabanda.com'));
      spotifyAccepts();

      const landing = await service.finishConnect({ code: 'the-code', state });

      expect(landing).toBe('https://minhabanda.com/admin/spotify?spotify=connected');
      const [tokenUrl, tokenRequest] = fetchMock.mock.calls[0];
      expect(tokenUrl).toBe('https://accounts.spotify.com/api/token');
      expect(String(tokenRequest.body)).toContain('code=the-code');
      const saved = prisma.spotifyConnection.upsert.mock.calls[0][0].create;
      expect(saved).toMatchObject({ id: 1, spotifyUserId: 'minhabanda', displayName: 'minhabanda.com', broken: false, connectedById: 3 });
      expect(saved.refreshToken).not.toContain('refresh-1');
      expect(decryptToken(saved.refreshToken, KEY)).toBe('refresh-1');
      expect(logService.logPlatform).toHaveBeenCalledWith('CONNECT', 'spotify', undefined, { spotifyUserId: 'minhabanda' }, { superAdminId: 3 });
      expect(await service.getAccessToken()).toBe('access-1');
    });

    it('should refuse a forged state without calling Spotify', async () => {
      const service = await createService();
      service.startConnect(3, 'https://minhabanda.com');

      expect(await service.finishConnect({ code: 'the-code', state: 'forged' })).toBe('/admin/spotify?spotify=expired');
      expect(await service.finishConnect({ code: 'the-code' })).toBe('/admin/spotify?spotify=expired');
      expect(fetchMock).not.toHaveBeenCalled();
      expect(prisma.spotifyConnection.upsert).not.toHaveBeenCalled();
    });

    it('should take a state only once', async () => {
      const service = await createService();
      const state = stateOf(service.startConnect(3, 'https://minhabanda.com'));
      spotifyAccepts();

      await service.finishConnect({ code: 'the-code', state });
      const again = await service.finishConnect({ code: 'the-code', state });

      expect(again).toBe('/admin/spotify?spotify=expired');
      expect(prisma.spotifyConnection.upsert).toHaveBeenCalledTimes(1);
    });

    it('should refuse a state older than ten minutes', async () => {
      jest.useFakeTimers({ now: new Date('2026-11-23T12:00:00Z') });
      const service = await createService();
      const state = stateOf(service.startConnect(3, 'https://minhabanda.com'));
      jest.setSystemTime(new Date('2026-11-23T12:10:01Z'));

      expect(await service.finishConnect({ code: 'the-code', state })).toBe('/admin/spotify?spotify=expired');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should refuse the state of a super admin disabled meanwhile', async () => {
      const service = await createService();
      const state = stateOf(service.startConnect(3, 'https://minhabanda.com'));
      prisma.superAdmin.findFirst.mockResolvedValue(null);

      expect(await service.finishConnect({ code: 'the-code', state })).toMatch(/spotify=expired$/);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should come back with nothing changed when the super admin cancels on Spotify', async () => {
      const service = await createService();
      const state = stateOf(service.startConnect(3, 'https://minhabanda.com'));

      expect(await service.finishConnect({ error: 'access_denied', state })).toBe(
        'https://minhabanda.com/admin/spotify?spotify=cancelled',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should say it failed when Spotify refuses the code', async () => {
      const service = await createService();
      const state = stateOf(service.startConnect(3, 'https://minhabanda.com'));
      fetchMock.mockImplementation(() => reply(400, { error: 'invalid_request' }));

      expect(await service.finishConnect({ code: 'bad', state })).toMatch(/spotify=failed$/);
      expect(prisma.spotifyConnection.upsert).not.toHaveBeenCalled();
    });

    it('should return only to an admin page of ours', async () => {
      const service = await createService();
      spotifyAccepts();

      const local = stateOf(service.startConnect(3, 'http://localhost:51731'));
      const evil = stateOf(service.startConnect(3, 'https://evil.example'));

      expect(await service.finishConnect({ code: 'c', state: local })).toBe('http://localhost:51731/admin/spotify?spotify=connected');
      expect(await service.finishConnect({ code: 'c', state: evil })).toBe('/admin/spotify?spotify=connected');
    });
  });

  describe('access tokens', () => {
    function storedConnection(overrides: object = {}) {
      prisma.spotifyConnection.findUnique.mockResolvedValue({
        id: 1,
        spotifyUserId: 'minhabanda',
        refreshToken: encryptToken('refresh-1', KEY),
        broken: false,
        ...overrides,
      });
    }

    it('should refresh with the stored token and keep the access token until it expires', async () => {
      storedConnection();
      const service = await createService();
      fetchMock.mockImplementation(() => reply(200, { access_token: 'access-2', expires_in: 3600 }));

      expect(await service.getAccessToken()).toBe('access-2');
      expect(await service.getAccessToken()).toBe('access-2');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0][1].body)).toContain('refresh_token=refresh-1');
      expect(prisma.spotifyConnection.update).not.toHaveBeenCalled();
    });

    it('should keep a new refresh token Spotify sends, encrypted', async () => {
      storedConnection();
      const service = await createService();
      fetchMock.mockImplementation(() => reply(200, { access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 3600 }));

      await service.getAccessToken();

      const { refreshToken } = prisma.spotifyConnection.update.mock.calls[0][0].data;
      expect(decryptToken(refreshToken, KEY)).toBe('refresh-2');
    });

    it('should share one refresh between requests at the same moment', async () => {
      storedConnection();
      const service = await createService();
      fetchMock.mockImplementation(() => reply(200, { access_token: 'access-2', expires_in: 3600 }));

      const tokens = await Promise.all([service.getAccessToken(), service.getAccessToken()]);

      expect(tokens).toEqual(['access-2', 'access-2']);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should mark the connection broken when Spotify refuses the refresh token', async () => {
      storedConnection();
      const service = await createService();
      fetchMock.mockImplementation(() => reply(400, { error: 'invalid_grant', error_description: 'Refresh token revoked' }));

      expect(await service.getAccessToken()).toBeNull();
      expect(prisma.spotifyConnection.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { broken: true } });
      expect(logService.logPlatform).toHaveBeenCalledWith('BROKEN', 'spotify', undefined, expect.anything(), {});
    });

    it('should mark it broken when the token key changed', async () => {
      storedConnection({ refreshToken: encryptToken('refresh-1', Buffer.alloc(32, 9)) });
      const service = await createService();

      expect(await service.getAccessToken()).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(prisma.spotifyConnection.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { broken: true } });
    });

    it('should not mark it broken when Spotify is only down', async () => {
      storedConnection();
      const service = await createService();
      fetchMock.mockImplementation(() => reply(503, { error: 'server_error' }));

      await expect(service.getAccessToken()).rejects.toThrow();
      expect(prisma.spotifyConnection.update).not.toHaveBeenCalled();
    });

    it('should give no token for a broken connection or none at all', async () => {
      const service = await createService();
      expect(await service.getAccessToken()).toBeNull();

      storedConnection({ broken: true });
      expect(await service.getAccessToken()).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('should tell band pages only whether playlists work, not set up, broken or missing', async () => {
    expect(await (await createService({ ...ENV, SPOTIFY_CLIENT_ID: '' })).availability()).toBe('not-set-up');

    const service = await createService();
    expect(await service.availability()).toBe('unavailable');
    prisma.spotifyConnection.findUnique.mockResolvedValue({ broken: true });
    expect(await service.availability()).toBe('unavailable');
    prisma.spotifyConnection.findUnique.mockResolvedValue({ broken: false });
    expect(await service.availability()).toBe('working');
    expect(prisma.spotifyConnection.findUnique).toHaveBeenLastCalledWith({ where: { id: 1 }, select: { broken: true } });
  });

  it('should delete the tokens on disconnect and log it', async () => {
    const service = await createService();

    await service.disconnect();

    expect(prisma.spotifyConnection.deleteMany).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(logService.logPlatform).toHaveBeenCalledWith('DISCONNECT', 'spotify');
    expect(await service.getAccessToken()).toBeNull();
  });

  it('should show who connected the account and whether it still works', async () => {
    prisma.spotifyConnection.findUnique.mockResolvedValue({
      spotifyUserId: 'minhabanda',
      displayName: 'minhabanda.com',
      refreshToken: 'v1:secret',
      broken: true,
      connectedAt: new Date('2026-11-23T12:00:00Z'),
      connectedBy: { name: 'Paula' },
    });
    const service = await createService();

    const status = await service.status();

    expect(status.connection).toEqual({
      spotifyUserId: 'minhabanda',
      displayName: 'minhabanda.com',
      broken: true,
      connectedAt: new Date('2026-11-23T12:00:00Z'),
      connectedBy: 'Paula',
    });
    expect(JSON.stringify(status)).not.toContain('secret');
  });
});
