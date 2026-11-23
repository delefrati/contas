import { SpotifyConfig } from './spotify-config';

const ACCOUNTS = 'https://accounts.spotify.com';
const API = 'https://api.spotify.com/v1';

// Only what MB-14 settled: public playlists in the platform's account
export const SPOTIFY_SCOPES = ['playlist-modify-public'];

export interface SpotifyTokens {
  accessToken: string;
  // Seconds
  expiresIn: number;
  // Spotify may send a new one with a refresh, which then replaces the stored one
  refreshToken?: string;
}

export interface SpotifyUser {
  id: string;
  displayName: string | null;
}

// Spotify no longer accepts the refresh token: the account has to be connected again
export class SpotifyGrantRevokedError extends Error {}

export class SpotifyRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function authorizeUrl(config: SpotifyConfig, state: string): string {
  const query = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    scope: SPOTIFY_SCOPES.join(' '),
    state,
    // Always show Spotify's page, so a super admin can pick which account to connect
    show_dialog: 'true',
  });
  return `${ACCOUNTS}/authorize?${query}`;
}

// Spotify's answers, loosely: only the fields read here
type SpotifyBody = Record<string, any>;

async function readBody(response: Response): Promise<SpotifyBody> {
  return (await response.json().catch(() => ({}))) as SpotifyBody;
}

async function tokenRequest(config: SpotifyConfig, body: Record<string, string>): Promise<SpotifyTokens> {
  const response = await fetch(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams(body),
  });
  const data = await readBody(response);
  if (!response.ok) {
    if (data?.error === 'invalid_grant') throw new SpotifyGrantRevokedError(data.error_description || 'invalid_grant');
    throw new SpotifyRequestError(response.status, data?.error_description || data?.error || 'Spotify token request failed');
  }
  return { accessToken: data.access_token, expiresIn: data.expires_in, refreshToken: data.refresh_token || undefined };
}

export function exchangeCode(config: SpotifyConfig, code: string): Promise<SpotifyTokens> {
  return tokenRequest(config, { grant_type: 'authorization_code', code, redirect_uri: config.redirectUri });
}

export function refreshAccessToken(config: SpotifyConfig, refreshToken: string): Promise<SpotifyTokens> {
  return tokenRequest(config, { grant_type: 'refresh_token', refresh_token: refreshToken });
}

export async function currentUser(accessToken: string): Promise<SpotifyUser> {
  const response = await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await readBody(response);
  if (!response.ok) {
    throw new SpotifyRequestError(response.status, data?.error?.message || 'Spotify request failed');
  }
  return { id: data.id, displayName: data.display_name ?? null };
}
