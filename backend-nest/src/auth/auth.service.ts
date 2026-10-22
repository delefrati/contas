import { Injectable, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { MemberService } from '../member/member.service';
import { RequestContextService } from '../common/request-context.service';

export interface AuthPayload {
  memberId: number;
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

interface LoginCode {
  memberId: number;
  bandId: number;
  expiresAt: number;
}

const LOGIN_CODE_TTL_MS = 60_000;

export interface LoginResponse {
  token: string;
  member: {
    id: number;
    name: string;
    email?: string;
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

  private async verifyGoogleToken(idToken: string): Promise<{ oidcSub: string; email?: string }> {
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

    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload) throw new Error('Empty payload');
      oidcSub = payload.sub;
      email = payload.email;
    } catch {
      throw new BadRequestException('Invalid Google token');
    }

    return { oidcSub, email };
  }

  async loginWithGoogle(idToken: string): Promise<LoginResponse> {
    const { oidcSub, email } = await this.verifyGoogleToken(idToken);

    let member = await this.memberService.findByOidcSub(oidcSub);
    if (!member && email) {
      member = await this.memberService.findByEmail(email);
    }

    if (!member) {
      throw new BadRequestException('Member not found. Please contact an administrator.');
    }

    if (!member.active) {
      throw new BadRequestException('Member account is disabled');
    }

    const token = await this.createToken(member.id, member.email, member.name);

    await this.logService.log(
      'LOGIN',
      'auth',
      member.id,
      { method: 'google', oidcSub },
    );

    return {
      token,
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
      },
    };
  }

  // Login on the central host: find the account's bands and issue a code for one of them.
  async centralLoginWithGoogle(idToken: string, bandSlug?: string): Promise<CentralLoginResponse> {
    const { oidcSub, email } = await this.verifyGoogleToken(idToken);

    const memberships = await this.prisma.member.findMany({
      where: {
        active: true,
        OR: [{ oidcSub }, ...(email ? [{ email }] : [])],
      },
      include: { band: true },
      orderBy: { band: { name: 'asc' } },
    });

    if (memberships.length === 0) {
      throw new BadRequestException('Member not found. Please contact an administrator.');
    }

    let chosen = memberships.length === 1 && !bandSlug ? memberships[0] : undefined;
    if (bandSlug) {
      chosen = memberships.find((m) => m.band.slug === bandSlug);
      if (!chosen) {
        throw new BadRequestException('Member not found in this band. Please contact an administrator.');
      }
    }

    if (!chosen) {
      return { bands: memberships.map((m) => ({ slug: m.band.slug, name: m.band.name })) };
    }

    return { code: this.issueLoginCode(chosen.id, chosen.bandId), band: chosen.band.slug };
  }

  // Exchange a central-login code on the band subdomain it was issued for.
  async exchangeLoginCode(code: string): Promise<LoginResponse> {
    const entry = code ? this.loginCodes.get(code) : undefined;
    if (code) this.loginCodes.delete(code);

    const bandId = this.requestContext.requireBandId();
    if (!entry || entry.expiresAt < Date.now() || entry.bandId !== bandId) {
      throw new BadRequestException('Invalid or expired login code');
    }

    const member = await this.prisma.member.findFirst({
      where: { id: entry.memberId, bandId, active: true },
    });
    if (!member) {
      throw new BadRequestException('Member account is disabled');
    }

    const token = await this.createToken(member.id, member.email ?? undefined, member.name);

    await this.logService.log('LOGIN', 'auth', member.id, { method: 'google-central' });

    return {
      token,
      member: {
        id: member.id,
        name: member.name,
        email: member.email ?? undefined,
      },
    };
  }

  private issueLoginCode(memberId: number, bandId: number): string {
    const now = Date.now();
    for (const [key, value] of this.loginCodes) {
      if (value.expiresAt < now) this.loginCodes.delete(key);
    }

    const code = randomBytes(32).toString('base64url');
    this.loginCodes.set(code, { memberId, bandId, expiresAt: now + LOGIN_CODE_TTL_MS });
    return code;
  }

  async createToken(memberId: number, email?: string, name?: string): Promise<string> {
    const expiresIn = '24h';
    const payload: AuthPayload = {
      memberId,
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
        memberId,
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

  async logout(memberId: number, token: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: {
        memberId,
        token,
      },
    });

    await this.logService.log(
      'LOGOUT',
      'auth',
      memberId,
      {},
    );
  }

  async logoutAll(memberId: number): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { memberId },
    });

    await this.logService.log(
      'LOGOUT_ALL',
      'auth',
      memberId,
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
