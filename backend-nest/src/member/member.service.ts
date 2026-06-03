import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';

export class MemberDto {
  id!: number;
  name!: string;
  email?: string;
  oidcSub?: string;
  active!: boolean;
}

@Injectable()
export class MemberService {
  constructor(
    private prisma: PrismaService,
    private logService: LogService,
  ) {}

  async findAll(): Promise<MemberDto[]> {
    const members = await this.prisma.member.findMany({
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });

    return members.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email ?? undefined,
      oidcSub: member.oidcSub ?? undefined,
      active: member.active,
    }));
  }

  async findByEmail(email: string): Promise<MemberDto | null> {
    const member = await this.prisma.member.findUnique({
      where: { email },
    });

    if (!member) return null;

    return {
      id: member.id,
      name: member.name,
      email: member.email ?? undefined,
      oidcSub: member.oidcSub ?? undefined,
      active: member.active,
    };
  }

  async findByOidcSub(oidcSub: string): Promise<MemberDto | null> {
    const member = await this.prisma.member.findUnique({
      where: { oidcSub },
    });

    if (!member) return null;

    return {
      id: member.id,
      name: member.name,
      email: member.email ?? undefined,
      oidcSub: member.oidcSub ?? undefined,
      active: member.active,
    };
  }

  async create(name: string, email?: string, oidcSub?: string): Promise<MemberDto> {
    if (email) {
      const existing = await this.prisma.member.findUnique({
        where: { email },
      });
      if (existing) {
        throw new BadRequestException(`Email ${email} is already in use`);
      }
    }

    if (oidcSub) {
      const existing = await this.prisma.member.findUnique({
        where: { oidcSub },
      });
      if (existing) {
        throw new BadRequestException(`OIDC Subject is already in use`);
      }
    }

    const member = await this.prisma.member.create({
      data: {
        name,
        email: email || null,
        oidcSub: oidcSub || null,
      },
    });

    await this.logService.log(
      'CREATE',
      'member',
      member.id,
      { name, email: email || null },
    );

    return {
      id: member.id,
      name: member.name,
      email: member.email ?? undefined,
      oidcSub: member.oidcSub ?? undefined,
      active: member.active,
    };
  }

  async update(
    id: number,
    name?: string,
    email?: string,
  ): Promise<MemberDto> {
    const existing = await this.prisma.member.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Member ${id} not found`);

    if (email && email !== existing.email) {
      const emailExists = await this.prisma.member.findUnique({
        where: { email },
      });
      if (emailExists) {
        throw new BadRequestException(`Email ${email} is already in use`);
      }
    }

    const updated = await this.prisma.member.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email: email || null }),
      },
    });

    await this.logService.log(
      'UPDATE',
      'member',
      id,
      { name, email },
    );

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email ?? undefined,
      oidcSub: updated.oidcSub ?? undefined,
      active: updated.active,
    };
  }

  async toggleActive(id: number): Promise<MemberDto> {
    const existing = await this.prisma.member.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Member ${id} not found`);

    const updated = await this.prisma.member.update({
      where: { id },
      data: { active: !existing.active },
    });

    await this.logService.log(
      'TOGGLE_ACTIVE',
      'member',
      id,
      { active: updated.active },
    );

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email ?? undefined,
      oidcSub: updated.oidcSub ?? undefined,
      active: updated.active,
    };
  }

  async linkOidcSub(id: number, oidcSub: string): Promise<MemberDto> {
    const existing = await this.prisma.member.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Member ${id} not found`);

    const oidcExists = await this.prisma.member.findUnique({
      where: { oidcSub },
    });
    if (oidcExists && oidcExists.id !== id) {
      throw new BadRequestException('OIDC Subject is already linked to another member');
    }

    const updated = await this.prisma.member.update({
      where: { id },
      data: { oidcSub },
    });

    await this.logService.log(
      'LINK_OIDC',
      'member',
      id,
      { oidcSub },
    );

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email ?? undefined,
      oidcSub: updated.oidcSub ?? undefined,
      active: updated.active,
    };
  }
}
