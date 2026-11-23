import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { SpotifyConfig, readSpotifyConfig } from './spotify-config';
import { TokenDecryptError, decryptToken, encryptToken } from './token-crypto';
import {
  SpotifyGrantRevokedError,
  SpotifyTokens,
  authorizeUrl,
  currentUser,
  exchangeCode,
  refreshAccessToken,
} from './spotify-api';

// There is one connection for the whole platform
const CONNECTION_ID = 1;
const STATE_TTL_MS = 10 * 60 * 1000;
// Refresh a little before Spotify's expiry, so a token never runs out mid-request
const EXPIRY_MARGIN_MS = 60 * 1000;
const ADMIN_PAGE = '/admin/spotify';

// How the connect flow ended, as ?spotify=<outcome> on the admin page
export type ConnectOutcome = 'connected' | 'cancelled' | 'expired' | 'failed';

export interface SpotifyStatusDto {
  configured: boolean;
  // Why it isn't set up, when that is a mistake in the server's settings
  problem: string | null;
  connection: {
    spotifyUserId: string;
    displayName: string | null;
    broken: boolean;
    connectedAt: Date;
    connectedBy: string | null;
  } | null;
}

interface PendingConnect {
  superAdminId: number;
  returnTo: string;
  expiresAt: number;
}

@Injectable()
export class SpotifyService {
  private readonly logger = new Logger(SpotifyService.name);
  private readonly config: SpotifyConfig | null = null;
  private readonly configProblem: string | null = null;
  // Single-use states handed to Spotify, so the callback can prove which super admin started it
  private readonly pending = new Map<string, PendingConnect>();
  private access: { token: string; expiresAt: number } | null = null;
  private refreshing: Promise<string | null> | null = null;

  constructor(
    private prisma: PrismaService,
    private logService: LogService,
  ) {
    try {
      this.config = readSpotifyConfig();
    } catch (error) {
      this.configProblem = (error as Error).message;
      this.logger.error(this.configProblem);
    }
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  async status(): Promise<SpotifyStatusDto> {
    const connection = this.config
      ? await this.prisma.spotifyConnection.findUnique({
          where: { id: CONNECTION_ID },
          include: { connectedBy: { select: { name: true } } },
        })
      : null;

    return {
      configured: this.isConfigured(),
      problem: this.configProblem,
      connection: connection && {
        spotifyUserId: connection.spotifyUserId,
        displayName: connection.displayName,
        broken: connection.broken,
        connectedAt: connection.connectedAt,
        connectedBy: connection.connectedBy?.name ?? null,
      },
    };
  }

  // The Spotify page to send the super admin to. origin is the admin page's, to come back to it.
  startConnect(superAdminId: number, origin?: string): string {
    const config = this.requireConfig();
    const now = Date.now();
    for (const [key, entry] of this.pending) {
      if (entry.expiresAt < now) this.pending.delete(key);
    }

    const state = randomBytes(32).toString('base64url');
    this.pending.set(state, { superAdminId, returnTo: this.returnUrl(origin), expiresAt: now + STATE_TTL_MS });
    return authorizeUrl(config, state);
  }

  // Spotify's redirect back. Returns where to send the browser; never throws.
  async finishConnect(query: { code?: string; state?: string; error?: string }): Promise<string> {
    const entry = query.state ? this.pending.get(query.state) : undefined;
    if (query.state) this.pending.delete(query.state);

    if (!entry || entry.expiresAt < Date.now()) return this.landing(this.returnUrl(), 'expired');
    if (query.error || !query.code) return this.landing(entry.returnTo, query.error === 'access_denied' ? 'cancelled' : 'failed');

    const superAdmin = await this.prisma.superAdmin.findFirst({ where: { id: entry.superAdminId, active: true } });
    if (!superAdmin || !this.config) return this.landing(entry.returnTo, 'expired');

    try {
      const tokens = await exchangeCode(this.config, query.code);
      if (!tokens.refreshToken) throw new Error('Spotify sent no refresh token');
      const user = await currentUser(tokens.accessToken);

      const data = {
        spotifyUserId: user.id,
        displayName: user.displayName,
        refreshToken: encryptToken(tokens.refreshToken, this.config.tokenKey),
        broken: false,
        connectedById: superAdmin.id,
        connectedAt: new Date(),
      };
      await this.prisma.spotifyConnection.upsert({
        where: { id: CONNECTION_ID },
        create: { id: CONNECTION_ID, ...data },
        update: data,
      });
      this.keepAccess(tokens);

      await this.logService.logPlatform('CONNECT', 'spotify', undefined, { spotifyUserId: user.id }, {
        superAdminId: superAdmin.id,
      });
      return this.landing(entry.returnTo, 'connected');
    } catch (error) {
      this.logger.error(`Connecting Spotify failed: ${(error as Error).message}`);
      return this.landing(entry.returnTo, 'failed');
    }
  }

  // Playlists already made stay in the account
  async disconnect(): Promise<void> {
    const { count } = await this.prisma.spotifyConnection.deleteMany({ where: { id: CONNECTION_ID } });
    this.access = null;
    if (count > 0) await this.logService.logPlatform('DISCONNECT', 'spotify');
  }

  // For the playlists (MB-17): a working access token, or null when there is no working connection
  async getAccessToken(): Promise<string | null> {
    if (!this.config) return null;
    if (this.access && this.access.expiresAt > Date.now()) return this.access.token;
    // Requests at the same moment share one refresh
    this.refreshing ??= this.refresh(this.config).finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async refresh(config: SpotifyConfig): Promise<string | null> {
    const connection = await this.prisma.spotifyConnection.findUnique({ where: { id: CONNECTION_ID } });
    if (!connection || connection.broken) return null;

    try {
      const tokens = await refreshAccessToken(config, decryptToken(connection.refreshToken, config.tokenKey));
      if (tokens.refreshToken) {
        await this.prisma.spotifyConnection.update({
          where: { id: CONNECTION_ID },
          data: { refreshToken: encryptToken(tokens.refreshToken, config.tokenKey) },
        });
      }
      return this.keepAccess(tokens);
    } catch (error) {
      if (!(error instanceof SpotifyGrantRevokedError) && !(error instanceof TokenDecryptError)) {
        // Spotify down or unreachable: the connection may still be fine
        throw error;
      }
      // Spotify refused the token, or SPOTIFY_TOKEN_KEY changed: only connecting again fixes it
      this.logger.warn(`Spotify connection broken: ${error.message}`);
      this.access = null;
      await this.prisma.spotifyConnection.update({ where: { id: CONNECTION_ID }, data: { broken: true } });
      await this.logService.logPlatform('BROKEN', 'spotify', undefined, { reason: error.message }, {});
      return null;
    }
  }

  private keepAccess(tokens: SpotifyTokens): string {
    this.access = { token: tokens.accessToken, expiresAt: Date.now() + tokens.expiresIn * 1000 - EXPIRY_MARGIN_MS };
    return tokens.accessToken;
  }

  private requireConfig(): SpotifyConfig {
    if (!this.config) throw new BadRequestException('Spotify is not set up on this server.');
    return this.config;
  }

  // Back to the admin page the connect started from, when it is one of ours
  private returnUrl(origin?: string): string {
    const baseDomain = (process.env.BASE_DOMAIN || '').trim().toLowerCase();
    const allowed = [
      ...(baseDomain ? [`https://${baseDomain}`] : []),
      ...(process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean),
    ];
    return origin && allowed.includes(origin) ? `${origin}${ADMIN_PAGE}` : ADMIN_PAGE;
  }

  private landing(returnTo: string, outcome: ConnectOutcome): string {
    return `${returnTo}?spotify=${outcome}`;
  }
}
