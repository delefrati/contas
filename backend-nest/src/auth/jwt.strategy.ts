import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { AuthService, AuthPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
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

    return {
      memberId: payload.memberId,
      email: payload.email,
      name: payload.name,
      oidcSub: payload.oidcSub,
    };
  }
}
