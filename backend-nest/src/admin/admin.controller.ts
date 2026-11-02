import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AdminLoginResponse, AdminPayload, AuthService } from '../auth/auth.service';
import { MemberDto } from '../member/member.service';
import { AdminAuthGuard, AdminRequest } from './admin-auth.guard';
import { AdminBandDto, AdminService, NewBand, SuperAdminDto } from './admin.service';

// Sign-in to the admin panel; the panel itself is AdminController
@Controller('api/admin/auth')
export class AdminAuthController {
  constructor(private authService: AuthService) {}

  @Post('google')
  async login(@Body() body: { credential: string }): Promise<{ data: AdminLoginResponse }> {
    const data = await this.authService.adminLoginWithGoogle(body.credential);
    return { data };
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  me(@Req() req: AdminRequest): { data: AdminPayload } {
    return { data: req.admin! };
  }

  @Post('logout')
  @UseGuards(AdminAuthGuard)
  async logout(@Req() req: AdminRequest): Promise<{ message: string }> {
    const token = req.headers.authorization!.slice('Bearer '.length);
    await this.authService.adminLogout(req.admin!.superAdminId, token);
    return { message: 'Logged out successfully' };
  }
}

@Controller('api/admin')
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('bands')
  async listBands(): Promise<{ data: AdminBandDto[] }> {
    return { data: await this.adminService.listBands() };
  }

  @Post('bands')
  async createBand(@Body() body: NewBand): Promise<{ data: AdminBandDto }> {
    return { data: await this.adminService.createBand(body) };
  }

  @Get('bands/:id')
  async getBand(@Param('id', ParseIntPipe) id: number): Promise<{ data: AdminBandDto }> {
    return { data: await this.adminService.getBand(id) };
  }

  @Patch('bands/:id')
  async updateBand(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; active?: boolean },
  ): Promise<{ data: AdminBandDto }> {
    return { data: await this.adminService.updateBand(id, body) };
  }

  @Get('bands/:id/members')
  async listMembers(@Param('id', ParseIntPipe) id: number): Promise<{ data: MemberDto[] }> {
    return { data: await this.adminService.listMembers(id) };
  }

  @Post('bands/:id/members')
  async createMember(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; email?: string },
  ): Promise<{ data: MemberDto }> {
    return { data: await this.adminService.createMember(id, body) };
  }

  @Patch('bands/:id/members/:memberId')
  async updateMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() body: { name?: string; email?: string },
  ): Promise<{ data: MemberDto }> {
    return { data: await this.adminService.updateMember(id, memberId, body) };
  }

  @Patch('bands/:id/members/:memberId/toggle-active')
  async toggleMemberActive(
    @Param('id', ParseIntPipe) id: number,
    @Param('memberId', ParseIntPipe) memberId: number,
  ): Promise<{ data: MemberDto }> {
    return { data: await this.adminService.toggleMemberActive(id, memberId) };
  }

  @Get('super-admins')
  async listSuperAdmins(): Promise<{ data: SuperAdminDto[] }> {
    return { data: await this.adminService.listSuperAdmins() };
  }

  @Post('super-admins')
  async createSuperAdmin(@Body() body: { name?: string; email?: string }): Promise<{ data: SuperAdminDto }> {
    return { data: await this.adminService.createSuperAdmin(body) };
  }

  @Patch('super-admins/:id/toggle-active')
  async toggleSuperAdminActive(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AdminRequest,
  ): Promise<{ data: SuperAdminDto }> {
    return { data: await this.adminService.toggleSuperAdminActive(id, req.admin!.superAdminId) };
  }
}
