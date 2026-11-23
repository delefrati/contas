import { readSpotifyConfig } from './spotify-config';

const KEY = Buffer.alloc(32, 7).toString('base64');
const full = {
  SPOTIFY_CLIENT_ID: 'id',
  SPOTIFY_CLIENT_SECRET: 'secret',
  SPOTIFY_REDIRECT_URI: 'https://minhabanda.com/api/admin/spotify/callback',
  SPOTIFY_TOKEN_KEY: KEY,
};

describe('readSpotifyConfig', () => {
  it('should read all four variables', () => {
    const config = readSpotifyConfig(full);

    expect(config).toMatchObject({ clientId: 'id', clientSecret: 'secret' });
    expect(config!.tokenKey).toHaveLength(32);
  });

  it.each(Object.keys(full))('should leave Spotify off without %s', (name) => {
    expect(readSpotifyConfig({ ...full, [name]: ' ' })).toBeNull();
  });

  it('should report a key that is not 32 bytes', () => {
    expect(() => readSpotifyConfig({ ...full, SPOTIFY_TOKEN_KEY: Buffer.alloc(16).toString('base64') })).toThrow(
      /openssl rand -base64 32/,
    );
  });
});
