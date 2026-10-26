import { Injectable, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { MemberService } from '../member/member.service';
import { Identity, RequestContextService } from '../common/request-context.service';

// Identifies either a band member or a super admin (see Identity)
export interface AuthPayload extends Identity {
  bandId: number;
  email?: string;
  name: string;
  oidcSub?: string;
}

export interface CentralLoginResponse {
  // Set when the account maps to a single band (or the requested one)
  code?: string;
  band?: string;
  // Set when the account belongs to several bands and none was requested
  bands?: { slug: string; name: string }[];
}

interface LoginCode extends Identity {
  bandId: number;
  expiresAt: number;
}

const LOGIN_CODE_TTL_MS = 60_000;

export interface LoginResponse {
  token: string;
  member: {
    // Unset for super admins, who aren't members of the band
    id?: number;
    name: string;
    email?: string;
    superAdmin?: boolean;
  };
}

@Injectable()
export class AuthService {
  // Single-use codes handing a central login (BASE_DOMAIN) over to a band subdomain
  private loginCodes = new Map<string, LoginCode>();

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private logService: LogService,
    private memberService: MemberService,
    private requestContext: RequestContextService,
  ) {}

  private async verifyGoogleToken(
    idToken: string,
  ): Promise<{ oidcSub: string; email?: string; verifiedEmail?: string }> {
    if (!idToken) {
      throw new BadRequestException('Google ID token is required');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new BadRequestException('Google authentication is not configured');
    }

    const client = new OAuth2Client(clientId);

    let oidcSub: string;
    let email: string | undefined;
    let verifiedEmail: string | undefined;

    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload) throw new Error('Empty payload');
      oidcSub = payload.sub;
      email = payload.email;
      verifiedEmail = payload.email_verified === true ? payload.email : undefined;
    } catch {
      throw new BadRequestException('Invalid Google token');
    }

    return { oidcSub, email, verifiedEmail };
  }

  // Super admins are matched by email only, so it must be one Google has verified
  private async findSuperAdmin(verifiedEmail: string | undefined) {
    if (!verifiedEmail) return null;
    return this.prisma.superAdmin.findFirst({ where: { email: verifiedEmail, active: true } });
  }

  private async startSession(
    identity: Identity,
    account: { name: string; email?: string | null },
    details: Record<string, unknown>,
  ): Promise<LoginResponse> {
    const email = account.email ?? undefined;
    const token = await this.createToken(identity, email, account.name);

    await this.logService.log('LOGIN', 'auth', identity.memberId, details, identity);

    return {
      token,
      member: identity.superAdminId
        ? { name: account.name, email, superAdmin: true }
        : { id: identity.memberId, name: account.name, email },
    };
  }

  async loginWithGoogle(idToken: string): Promise<LoginResponse> {
    const { oidcSub, email, verifiedEmail } = await this.verifyGoogleToken(idToken);

    let member = await this.memberService.findByOidcSub(oidcSub);
    if (!member && email) {
      member = await this.memberService.findByEmail(email);
    }

    if (!member?.active) {
      const superAdmin = await this.findSuperAdmin(verifiedEmail);
      if (superAdmin) {
        return this.startSession({ superAdminId: superAdmin.id }, superAdmin, { method: 'google' });
      }
    }

    if (!member) {
      throw new BadRequestException('Member not found. Please contact an administrator.');
    }

    if (!member.active) {
      throw new BadRequestException('Member account is disabled');
    }

    return this.startSession({ memberId: member.id }, member, { method: 'google', oidcSub });
  }

  // Login on the central host: find the account's bands and issue a code for one of them.
  async centralLoginWithGoogle(idToken: string, bandSlug?: string): Promise<CentralLoginResponse> {
    const { oidcSub, email, verifiedEmail } = await this.verifyGoogleToken(idToken);

    const [memberships, superAdmin] = await Promise.all([
      this.prisma.member.findMany({
        where: {
          active: true,
          OR: [{ oidcSub }, ...(email ? [{ email }] : [])],
        },
        include: { band: true },
        orderBy: { band: { name: 'asc' } },
      }),
      this.findSuperAdmin(verifiedEmail),
    ]);

    // Super admins may enter every band; where they're also members they enter as such
    const bands = superAdmin
      ? await this.prisma.band.findMany({ orderBy: { name: 'asc' } })
      : memberships.map((m) => m.band);

    if (bands.length === 0) {
      throw new BadRequestException('Member not found. Please contact an administrator.');
    }

    let chosen = bands.length === 1 && !bandSlug ? bands[0] : undefined;
    if (bandSlug) {
      chosen = bands.find((b) => b.slug === bandSlug);
      if (!chosen) {
        throw new BadRequestException('Member not found in this band. Please contact an administrator.');
      }
    }

    if (!chosen) {
      return { bands: bands.map((b) => ({ slug: b.slug, name: b.name })) };
    }

    const membership = memberships.find((m) => m.bandId === chosen.id);
    const identity = membership ? { memberId: membership.id } : { superAdminId: superAdmin!.id };
    return { code: this.issueLoginCode(identity, chosen.id), band: chosen.slug };
  }

  // Exchange a central-login code on the band subdomain it was issued for.
  async exchangeLoginCode(code: string): Promise<LoginResponse> {
    const entry = code ? this.loginCodes.get(code) : undefined;
    if (code) this.loginCodes.delete(code);

    const bandId = this.requestContext.requireBandId();
    if (!entry || entry.expiresAt < Date.now() || entry.bandId !== bandId) {
      throw new BadRequestException('Invalid or expired login code');
    }

    if (entry.superAdminId) {
      const superAdmin = await this.prisma.superAdmin.findFirst({
        where: { id: entry.superAdminId, active: true },
      });
      if (!superAdmin) {
        throw new BadRequestException('Account is disabled');
      }
      return this.startSession({ superAdminId: superAdmin.id }, superAdmin, { method: 'google-central' });
    }

    const member = await this.prisma.member.findFirst({
      where: { id: entry.memberId, bandId, active: true },
    });
    if (!member) {
      throw new BadRequestException('Member account is disabled');
    }

    return this.startSession({ memberId: member.id }, member, { method: 'google-central' });
  }

  private issueLoginCode(identity: Identity, bandId: number): string {
    const now = Date.now();
    for (const [key, value] of this.loginCodes) {
      if (value.expiresAt < now) this.loginCodes.delete(key);
    }

    const code = randomBytes(32).toString('base64url');
    this.loginCodes.set(code, { ...identity, bandId, expiresAt: now + LOGIN_CODE_TTL_MS });
    return code;
  }

  // Sessions and their queries must always name their owner: an empty filter would match everyone
  private sessionOwner(identity: Identity): { memberId: number } | { superAdminId: number } {
    if (identity.superAdminId) return { superAdminId: identity.superAdminId };
    if (identity.memberId) return { memberId: identity.memberId };
    throw new BadRequestException('Session has no owner');
  }

  async createToken(identity: Identity, email?: string, name?: string): Promise<string> {
    const expiresIn = '24h';
    const owner = this.sessionOwner(identity);
    const payload: AuthPayload = {
      ...owner,
      bandId: this.requestContext.requireBandId(),
      email,
      name: name || '',
    };

    const token = this.jwtService.sign(payload, { expiresIn });

    // Store session in database
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await this.prisma.session.create({
      data: {
        ...owner,
        token,
        expiresAt,
      },
    });

    return token;
  }

  async validateToken(token: string): Promise<AuthPayload> {
    try {
      const payload = this.jwtService.verify<AuthPayload>(token);
      
      // Check if session still exists and is not expired
      const session = await this.prisma.session.findUnique({
        where: { token },
      });

      if (!session || session.expiresAt < new Date()) {
        throw new BadRequestException('Session expired');
      }

      return payload;
    } catch (error) {
      throw new BadRequestException('Invalid token');
    }
  }

  async logout(identity: Identity, token: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: {
        ...this.sessionOwner(identity),
        token,
      },
    });

    await this.logService.log(
      'LOGOUT',
      'auth',
      identity.memberId,
      {},
    );
  }

  async logoutAll(identity: Identity): Promise<void> {
    await this.prisma.session.deleteMany({
      where: this.sessionOwner(identity),
    });

    await this.logService.log(
      'LOGOUT_ALL',
      'auth',
      identity.memberId,
      {},
    );
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }
}
