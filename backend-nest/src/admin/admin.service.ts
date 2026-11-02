import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { MemberDto, MemberService } from '../member/member.service';
import { RequestContextService } from '../common/request-context.service';
import { isValidSlug } from '../band/band.service';

export interface AdminBandDto {
  id: number;
  slug: string;
  name: string;
  active: boolean;
  createdAt: Date;
  activeMembers: number;
}

export interface SuperAdminDto {
  id: number;
  name: string;
  email: string;
  active: boolean;
  createdAt: Date;
}

export interface NewBand {
  slug?: string;
  name?: string;
  // Optional first member, so someone other than super admins can sign in
  member?: { name?: string; email?: string };
}

// Every new band starts with these, as scripts/create-band.sh did
const DEFAULT_EVENT_TYPES = [
  { name: 'Show', color: '#667eea' },
  { name: 'Ensaio', color: '#48bb78' },
];

const ADMIN_BAND_FIELDS = {
  id: true,
  slug: true,
  name: true,
  active: true,
  createdAt: true,
  _count: { select: { members: { where: { active: true } } } },
} as const;

function toAdminBandDto(band: {
  id: number;
  slug: string;
  name: string;
  active: boolean;
  createdAt: Date;
  _count: { members: number };
}): AdminBandDto {
  return {
    id: band.id,
    slug: band.slug,
    name: band.name,
    active: band.active,
    createdAt: band.createdAt,
    activeMembers: band._count.members,
  };
}

function requireText(value: unknown, message: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > 255) throw new BadRequestException(message);
  return text;
}

function optionalEmail(value: unknown): string | undefined {
  const email = typeof value === 'string' ? value.trim() : '';
  if (!email) return undefined;
  if (email.length > 255 || !/^[^\s@]+@[^\s@]+$/.test(email)) {
    throw new BadRequestException(`Invalid email: ${email}`);
  }
  return email;
}

// The platform as super admins see it in the admin panel. Bands are picked by id here,
// never by host, and member changes run in that band's context (see RequestContextService.withBand)
// so they reuse MemberService's checks and land in the band's own log.
@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private logService: LogService,
    private memberService: MemberService,
    private requestContext: RequestContextService,
  ) {}

  async listBands(): Promise<AdminBandDto[]> {
    const bands = await this.prisma.band.findMany({ select: ADMIN_BAND_FIELDS, orderBy: { name: 'asc' } });
    return bands.map(toAdminBandDto);
  }

  async getBand(id: number): Promise<AdminBandDto> {
    const band = await this.prisma.band.findUnique({ where: { id }, select: ADMIN_BAND_FIELDS });
    if (!band) throw new NotFoundException(`Band ${id} not found`);
    return toAdminBandDto(band);
  }

  async createBand(input: NewBand): Promise<AdminBandDto> {
    const slug = typeof input.slug === 'string' ? input.slug.trim().toLowerCase() : '';
    if (!isValidSlug(slug)) {
      throw new BadRequestException(
        'Invalid address: use lowercase letters, digits and hyphens (not at the start or end)',
      );
    }
    const name = requireText(input.name, 'Band name is required');
    const member = input.member?.name || input.member?.email
      ? { name: requireText(input.member.name, 'Member name is required'), email: optionalEmail(input.member.email) }
      : undefined;

    if (await this.prisma.band.findUnique({ where: { slug }, select: { id: true } })) {
      throw new BadRequestException(`Address ${slug} is already taken`);
    }

    const band = await this.prisma.band.create({
      data: { slug, name, eventTypes: { create: DEFAULT_EVENT_TYPES } },
      select: { id: true },
    });

    await this.requestContext.withBand(band.id, async () => {
      await this.logService.log('CREATE', 'band', band.id, { slug, name });
      if (member) await this.memberService.create(member.name, member.email);
    });

    return this.getBand(band.id);
  }

  async updateBand(id: number, changes: { name?: string; active?: boolean }): Promise<AdminBandDto> {
    const existing = await this.getBand(id);
    const data: { name?: string; active?: boolean } = {};
    if (changes.name !== undefined) data.name = requireText(changes.name, 'Band name is required');
    if (changes.active !== undefined) {
      if (typeof changes.active !== 'boolean') throw new BadRequestException('active must be true or false');
      data.active = changes.active;
    }

    await this.prisma.band.update({ where: { id }, data });
    await this.requestContext.withBand(id, () =>
      this.logService.log('UPDATE', 'band', id, {
        ...(data.name !== undefined && { name: data.name, previousName: existing.name }),
        ...(data.active !== undefined && { active: data.active }),
      }),
    );

    return this.getBand(id);
  }

  async listMembers(bandId: number): Promise<MemberDto[]> {
    await this.getBand(bandId);
    return this.requestContext.withBand(bandId, () => this.memberService.findAll());
  }

  async createMember(bandId: number, input: { name?: string; email?: string }): Promise<MemberDto> {
    await this.getBand(bandId);
    const name = requireText(input.name, 'Member name is required');
    const email = optionalEmail(input.email);
    return this.requestContext.withBand(bandId, () => this.memberService.create(name, email));
  }

  async updateMember(
    bandId: number,
    memberId: number,
    input: { name?: string; email?: string },
  ): Promise<MemberDto> {
    await this.getBand(bandId);
    const name = input.name !== undefined ? requireText(input.name, 'Member name is required') : undefined;
    // An empty email clears it, as on the band's own members page
    const email = input.email !== undefined ? (optionalEmail(input.email) ?? '') : undefined;
    return this.requestContext.withBand(bandId, () => this.memberService.update(memberId, name, email));
  }

  async toggleMemberActive(bandId: number, memberId: number): Promise<MemberDto> {
    await this.getBand(bandId);
    return this.requestContext.withBand(bandId, () => this.memberService.toggleActive(memberId));
  }

  async listSuperAdmins(): Promise<SuperAdminDto[]> {
    return this.prisma.superAdmin.findMany({
      select: { id: true, name: true, email: true, active: true, createdAt: true },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  // Adding an email that belongs to a disabled super admin enables them again
  async createSuperAdmin(input: { name?: string; email?: string }): Promise<SuperAdminDto> {
    const name = requireText(input.name, 'Name is required');
    const email = optionalEmail(input.email);
    if (!email) throw new BadRequestException('Email is required');

    const existing = await this.prisma.superAdmin.findUnique({ where: { email } });
    if (existing?.active) {
      throw new BadRequestException(`${email} is already a super admin`);
    }

    const superAdmin = existing
      ? await this.prisma.superAdmin.update({ where: { id: existing.id }, data: { name, active: true } })
      : await this.prisma.superAdmin.create({ data: { name, email } });

    await this.logService.logPlatform(existing ? 'ENABLE' : 'CREATE', 'super_admin', superAdmin.id, {
      name,
      email,
    });
    return this.toSuperAdminDto(superAdmin);
  }

  // Disabling also ends their sessions. Nobody may disable themselves, so the
  // platform always keeps at least one active super admin.
  async toggleSuperAdminActive(id: number, actingSuperAdminId: number): Promise<SuperAdminDto> {
    if (id === actingSuperAdminId) {
      throw new BadRequestException('You cannot disable yourself');
    }
    const existing = await this.prisma.superAdmin.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Super admin ${id} not found`);

    const updated = await this.prisma.superAdmin.update({ where: { id }, data: { active: !existing.active } });
    if (!updated.active) {
      await this.prisma.session.deleteMany({ where: { superAdminId: id } });
    }

    await this.logService.logPlatform(updated.active ? 'ENABLE' : 'DISABLE', 'super_admin', id, {
      email: updated.email,
    });
    return this.toSuperAdminDto(updated);
  }

  private toSuperAdminDto(s: SuperAdminDto): SuperAdminDto {
    return { id: s.id, name: s.name, email: s.email, active: s.active, createdAt: s.createdAt };
  }
}
