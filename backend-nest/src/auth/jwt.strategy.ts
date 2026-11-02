import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { AuthService, AuthPayload } from './auth.service';
import { RequestContextService } from '../common/request-context.service';

const extractToken = ExtractJwt.fromAuthHeaderAsBearerToken();

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private requestContext: RequestContextService,
  ) {
    super({
      jwtFromRequest: extractToken,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any): Promise<AuthPayload> {
    if (!payload.memberId && !payload.superAdminId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // A token is only valid on the band (subdomain) it was issued for.
    if (!payload.bandId || payload.bandId !== this.requestContext.getBandId()) {
      throw new UnauthorizedException('Token does not belong to this band');
    }

    const identity = payload.superAdminId
      ? { superAdminId: payload.superAdminId }
      : { memberId: payload.memberId };
    const token = extractToken(req);
    if (!token || !(await this.authService.isBandSessionLive(token, identity, payload.bandId))) {
      throw new UnauthorizedException('Session expired or account disabled');
    }

    return {
      memberId: payload.memberId,
      superAdminId: payload.superAdminId,
      bandId: payload.bandId,
      email: payload.email,
      name: payload.name,
      oidcSub: payload.oidcSub,
    };
  }
}
