import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { MemberService } from '../member/member.service';

export interface AuthPayload {
  memberId: number;
  email?: string;
  name: string;
  oidcSub?: string;
}

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
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private logService: LogService,
    private memberService: MemberService,
  ) {}

  async loginWithGoogle(idToken: string): Promise<LoginResponse> {
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

  async createToken(memberId: number, email?: string, name?: string): Promise<string> {
    const expiresIn = '24h';
    const payload: AuthPayload = {
      memberId,
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
