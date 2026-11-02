import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { MemberService } from '../member/member.service';
import { RequestContextService } from '../common/request-context.service';

describe('AdminService', () => {
  const createdAt = new Date('2026-10-01T00:00:00Z');
  const bandRow = { id: 5, slug: 'nova', name: 'Nova', active: true, createdAt, _count: { members: 2 } };
  const bandDto = { id: 5, slug: 'nova', name: 'Nova', active: true, createdAt, activeMembers: 2 };

  let service: AdminService;
  let prisma: {
    band: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    superAdmin: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    session: { deleteMany: jest.Mock };
  };
  let logService: { log: jest.Mock; logPlatform: jest.Mock };
  let memberService: { findAll: jest.Mock; create: jest.Mock; update: jest.Mock; toggleActive: jest.Mock };
  // The band each MemberService/LogService call ran in, as withBand set it
  let currentBand: number | undefined;

  beforeEach(async () => {
    currentBand = undefined;
    prisma = {
      band: {
        findMany: jest.fn().mockResolvedValue([bandRow]),
        findUnique: jest.fn().mockResolvedValue(bandRow),
        create: jest.fn().mockResolvedValue({ id: 5 }),
        update: jest.fn().mockResolvedValue(bandRow),
      },
      superAdmin: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      session: { deleteMany: jest.fn() },
    };
    const inBand = (result: unknown) => jest.fn(async () => ({ result, bandId: currentBand }));
    logService = { log: inBand({}), logPlatform: jest.fn() };
    memberService = {
      findAll: inBand([]),
      create: inBand({ id: 1 }),
      update: inBand({ id: 1 }),
      toggleActive: inBand({ id: 1 }),
    };
    const requestContext = {
      withBand: jest.fn(async (bandId: number, fn: () => unknown) => {
        currentBand = bandId;
        try {
          return await fn();
        } finally {
          currentBand = undefined;
        }
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: LogService, useValue: logService },
        { provide: MemberService, useValue: memberService },
        { provide: RequestContextService, useValue: requestContext },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  describe('listBands', () => {
    it('should list every band, disabled ones included, with its active member count', async () => {
      expect(await service.listBands()).toEqual([bandDto]);
      expect(prisma.band.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } }),
      );
      expect(prisma.band.findMany.mock.calls[0][0]).not.toHaveProperty('where');
    });
  });

  describe('getBand', () => {
    it('should throw when the band does not exist', async () => {
      prisma.band.findUnique.mockResolvedValue(null);
      await expect(service.getBand(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createBand', () => {
    beforeEach(() => {
      // No band has the slug yet; then the created band is read back
      prisma.band.findUnique.mockResolvedValueOnce(null).mockResolvedValue(bandRow);
    });

    it('should create the band with the default event types and log it in the band', async () => {
      const result = await service.createBand({ slug: ' Nova ', name: ' Nova ' });

      expect(prisma.band.create).toHaveBeenCalledWith({
        data: {
          slug: 'nova',
          name: 'Nova',
          eventTypes: { create: [{ name: 'Show', color: '#667eea' }, { name: 'Ensaio', color: '#48bb78' }] },
        },
        select: { id: true },
      });
      expect(logService.log).toHaveBeenCalledWith('CREATE', 'band', 5, { slug: 'nova', name: 'Nova' });
      expect(await logService.log.mock.results[0].value).toMatchObject({ bandId: 5 });
      expect(memberService.create).not.toHaveBeenCalled();
      expect(result).toEqual(bandDto);
    });

    it('should add the first member inside the new band', async () => {
      await service.createBand({ slug: 'nova', name: 'Nova', member: { name: 'Ana', email: 'ana@test.com' } });

      expect(memberService.create).toHaveBeenCalledWith('Ana', 'ana@test.com');
      expect(await memberService.create.mock.results[0].value).toMatchObject({ bandId: 5 });
    });

    it.each(['', 'www', 'admin', '-nova', 'nova_banda', 'a.b'])('should reject the address %p', async (slug) => {
      await expect(service.createBand({ slug, name: 'Nova' })).rejects.toThrow(BadRequestException);
      expect(prisma.band.create).not.toHaveBeenCalled();
    });

    it('should reject an address that is already taken', async () => {
      prisma.band.findUnique.mockReset().mockResolvedValue({ id: 1 });
      await expect(service.createBand({ slug: 'nova', name: 'Nova' })).rejects.toThrow('already taken');
      expect(prisma.band.create).not.toHaveBeenCalled();
    });

    it('should validate the first member before creating anything', async () => {
      await expect(service.createBand({ slug: 'nova', name: 'Nova', member: { email: 'ana@test.com' } }))
        .rejects.toThrow('Member name is required');
      await expect(service.createBand({ slug: 'nova', name: 'Nova', member: { name: 'Ana', email: 'nope' } }))
        .rejects.toThrow('Invalid email');
      expect(prisma.band.create).not.toHaveBeenCalled();
    });

    it('should require a name', async () => {
      await expect(service.createBand({ slug: 'nova', name: '  ' })).rejects.toThrow('Band name is required');
    });
  });

  describe('updateBand', () => {
    it('should rename and disable the band, logging it in that band', async () => {
      await service.updateBand(5, { name: 'Nova Era', active: false });

      expect(prisma.band.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { name: 'Nova Era', active: false } });
      expect(logService.log).toHaveBeenCalledWith('UPDATE', 'band', 5, {
        name: 'Nova Era', previousName: 'Nova', active: false,
      });
      expect(await logService.log.mock.results[0].value).toMatchObject({ bandId: 5 });
    });

    it('should reject a non-boolean active flag', async () => {
      await expect(service.updateBand(5, { active: 'no' as unknown as boolean })).rejects.toThrow(BadRequestException);
      expect(prisma.band.update).not.toHaveBeenCalled();
    });

    it('should throw for an unknown band', async () => {
      prisma.band.findUnique.mockResolvedValue(null);
      await expect(service.updateBand(99, { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('members', () => {
    it('should list, add, edit and toggle members within the chosen band', async () => {
      await service.listMembers(5);
      await service.createMember(5, { name: ' Ana ', email: '' });
      await service.updateMember(5, 8, { name: 'Ana Maria', email: '' });
      await service.toggleMemberActive(5, 8);

      expect(memberService.create).toHaveBeenCalledWith('Ana', undefined);
      // An empty email clears it
      expect(memberService.update).toHaveBeenCalledWith(8, 'Ana Maria', '');
      expect(memberService.toggleActive).toHaveBeenCalledWith(8);
      for (const fn of [memberService.findAll, memberService.create, memberService.update, memberService.toggleActive]) {
        expect(await fn.mock.results[0].value).toMatchObject({ bandId: 5 });
      }
    });

    it('should not touch members of a band that does not exist', async () => {
      prisma.band.findUnique.mockResolvedValue(null);
      await expect(service.createMember(99, { name: 'Ana' })).rejects.toThrow(NotFoundException);
      expect(memberService.create).not.toHaveBeenCalled();
    });

    it('should leave the email alone when it is not sent', async () => {
      await service.updateMember(5, 8, { name: 'Ana' });
      expect(memberService.update).toHaveBeenCalledWith(8, 'Ana', undefined);
    });
  });

  describe('createSuperAdmin', () => {
    const row = { id: 4, name: 'Bia', email: 'bia@test.com', active: true, createdAt };

    it('should create a super admin and log it on the platform', async () => {
      prisma.superAdmin.findUnique.mockResolvedValue(null);
      prisma.superAdmin.create.mockResolvedValue(row);

      expect(await service.createSuperAdmin({ name: 'Bia', email: ' bia@test.com ' })).toEqual(row);
      expect(prisma.superAdmin.create).toHaveBeenCalledWith({ data: { name: 'Bia', email: 'bia@test.com' } });
      expect(logService.logPlatform).toHaveBeenCalledWith('CREATE', 'super_admin', 4, { name: 'Bia', email: 'bia@test.com' });
    });

    it('should enable a disabled super admin with the same email again', async () => {
      prisma.superAdmin.findUnique.mockResolvedValue({ ...row, active: false });
      prisma.superAdmin.update.mockResolvedValue(row);

      await service.createSuperAdmin({ name: 'Bia', email: 'bia@test.com' });

      expect(prisma.superAdmin.update).toHaveBeenCalledWith({ where: { id: 4 }, data: { name: 'Bia', active: true } });
      expect(logService.logPlatform).toHaveBeenCalledWith('ENABLE', 'super_admin', 4, expect.any(Object));
    });

    it('should reject an email that is already an active super admin', async () => {
      prisma.superAdmin.findUnique.mockResolvedValue(row);
      await expect(service.createSuperAdmin({ name: 'Bia', email: 'bia@test.com' })).rejects.toThrow('already');
    });

    it('should require a name and a valid email', async () => {
      await expect(service.createSuperAdmin({ email: 'bia@test.com' })).rejects.toThrow('Name is required');
      await expect(service.createSuperAdmin({ name: 'Bia' })).rejects.toThrow('Email is required');
      await expect(service.createSuperAdmin({ name: 'Bia', email: 'bia' })).rejects.toThrow('Invalid email');
    });
  });

  describe('toggleSuperAdminActive', () => {
    const row = { id: 4, name: 'Bia', email: 'bia@test.com', active: true, createdAt };

    it('should disable another super admin and end their sessions', async () => {
      prisma.superAdmin.findUnique.mockResolvedValue(row);
      prisma.superAdmin.update.mockResolvedValue({ ...row, active: false });

      const result = await service.toggleSuperAdminActive(4, 3);

      expect(result.active).toBe(false);
      expect(prisma.superAdmin.update).toHaveBeenCalledWith({ where: { id: 4 }, data: { active: false } });
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { superAdminId: 4 } });
      expect(logService.logPlatform).toHaveBeenCalledWith('DISABLE', 'super_admin', 4, { email: 'bia@test.com' });
    });

    it('should enable them again without touching sessions', async () => {
      prisma.superAdmin.findUnique.mockResolvedValue({ ...row, active: false });
      prisma.superAdmin.update.mockResolvedValue(row);

      await service.toggleSuperAdminActive(4, 3);

      expect(prisma.session.deleteMany).not.toHaveBeenCalled();
      expect(logService.logPlatform).toHaveBeenCalledWith('ENABLE', 'super_admin', 4, expect.any(Object));
    });

    it('should not let a super admin disable themselves', async () => {
      await expect(service.toggleSuperAdminActive(3, 3)).rejects.toThrow('You cannot disable yourself');
      expect(prisma.superAdmin.update).not.toHaveBeenCalled();
    });

    it('should throw for an unknown super admin', async () => {
      prisma.superAdmin.findUnique.mockResolvedValue(null);
      await expect(service.toggleSuperAdminActive(9, 3)).rejects.toThrow(NotFoundException);
    });
  });
});
