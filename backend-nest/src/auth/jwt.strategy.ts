import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { AuthService, AuthPayload } from './auth.service';
import { RequestContextService } from '../common/request-context.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private requestContext: RequestContextService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    });
  }

  async validate(payload: any): Promise<AuthPayload> {
    if (!payload.memberId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // A token is only valid on the band (subdomain) it was issued for.
    if (!payload.bandId || payload.bandId !== this.requestContext.getBandId()) {
      throw new UnauthorizedException('Token does not belong to this band');
    }

    return {
      memberId: payload.memberId,
      bandId: payload.bandId,
      email: payload.email,
      name: payload.name,
      oidcSub: payload.oidcSub,
    };
  }
}
