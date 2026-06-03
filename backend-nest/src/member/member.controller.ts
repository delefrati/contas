import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { MemberService, MemberDto } from './member.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/members')
@UseGuards(JwtAuthGuard)
export class MemberController {
  constructor(private memberService: MemberService) {}

  @Get()
  async list(): Promise<{ data: MemberDto[] }> {
    const data = await this.memberService.findAll();
    return { data };
  }

  @Get('email/:email')
  async findByEmail(@Param('email') email: string): Promise<{ data: MemberDto | null }> {
    const data = await this.memberService.findByEmail(email);
    return { data };
  }

  @Get('oidc/:oidcSub')
  async findByOidcSub(@Param('oidcSub') oidcSub: string): Promise<{ data: MemberDto | null }> {
    const data = await this.memberService.findByOidcSub(oidcSub);
    return { data };
  }

  @Post()
  async create(
    @Body() body: { name: string; email?: string; oidcSub?: string },
  ): Promise<{ data: MemberDto }> {
    const data = await this.memberService.create(
      body.name,
      body.email,
      body.oidcSub,
    );
    return { data };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; email?: string },
  ): Promise<{ data: MemberDto }> {
    const data = await this.memberService.update(id, body.name, body.email);
    return { data };
  }

  @Patch(':id/toggle-active')
  async toggleActive(@Param('id', ParseIntPipe) id: number): Promise<{ data: MemberDto }> {
    const data = await this.memberService.toggleActive(id);
    return { data };
  }

  @Patch(':id/link-oidc')
  async linkOidc(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { oidcSub: string },
  ): Promise<{ data: MemberDto }> {
    const data = await this.memberService.linkOidcSub(id, body.oidcSub);
    return { data };
  }
}
