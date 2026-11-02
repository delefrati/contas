import { CanActivate, ExecutionContext, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AdminPayload, AuthService } from '../auth/auth.service';
import { BandService } from '../band/band.service';

export type AdminRequest = Request & { admin?: AdminPayload };

// Admin panel endpoints: only on the central host, and only with an admin panel session
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private bandService: BandService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    if (!this.bandService.isCentralHost(req.headers.host)) {
      throw new NotFoundException();
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const admin = token ? await this.authService.validateAdminToken(token) : null;
    if (!admin) {
      throw new UnauthorizedException('Admin session expired or invalid');
    }

    req.admin = admin;
    return true;
  }
}
