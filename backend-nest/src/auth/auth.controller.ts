import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService, LoginResponse } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthPayload } from './auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login/google')
  async loginWithGoogle(
    @Body() body: { credential: string },
  ): Promise<{ data: LoginResponse }> {
    const data = await this.authService.loginWithGoogle(body.credential);
    return { data };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: Request & { user?: AuthPayload }): Promise<{ data: AuthPayload }> {
    if (!req.user) {
      throw new BadRequestException('User not found in request');
    }
    return { data: req.user };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: Request & { user?: AuthPayload },
  ): Promise<{ message: string }> {
    if (!req.user) {
      throw new BadRequestException('User not found in request');
    }

    const token = this.extractToken(req);
    await this.authService.logout(req.user.memberId, token);
    return { message: 'Logged out successfully' };
  }

  @Post('logout/all')
  @UseGuards(JwtAuthGuard)
  async logoutAll(
    @Req() req: Request & { user?: AuthPayload },
  ): Promise<{ message: string }> {
    if (!req.user) {
      throw new BadRequestException('User not found in request');
    }

    await this.authService.logoutAll(req.user.memberId);
    return { message: 'Logged out from all devices' };
  }

  private extractToken(req: Request): string {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new BadRequestException('Authorization header missing');
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new BadRequestException('Invalid authorization header');
    }
    return parts[1];
  }
}
