export interface SpotifyConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  // 32 bytes for AES-256-GCM
  tokenKey: Buffer;
}

const VARIABLES = ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REDIRECT_URI', 'SPOTIFY_TOKEN_KEY'];

// Spotify is optional: without all four variables it is simply not set up. A key of the wrong
// size is a mistake, not a choice, so it is reported instead of quietly turning Spotify off.
export function readSpotifyConfig(env: NodeJS.ProcessEnv = process.env): SpotifyConfig | null {
  const values = VARIABLES.map((name) => (env[name] ?? '').trim());
  if (values.some((value) => !value)) return null;

  const [clientId, clientSecret, redirectUri, key] = values;
  const tokenKey = Buffer.from(key, 'base64');
  if (tokenKey.length !== 32) {
    throw new Error('SPOTIFY_TOKEN_KEY must be 32 bytes in base64. Make one with: openssl rand -base64 32');
  }

  return { clientId, clientSecret, redirectUri, tokenKey };
}
