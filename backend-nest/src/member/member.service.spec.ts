import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MemberService } from './member.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { RequestContextService } from '../common/request-context.service';

describe('MemberService', () => {
  let service: MemberService;
  let prisma: {
    member: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let logService: { log: jest.Mock };
  let requestContext: { requireBandId: jest.Mock; getBandId: jest.Mock; getIdentity: jest.Mock };

  beforeEach(async () => {
    prisma = {
      member: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    logService = { log: jest.fn().mockResolvedValue({}) };
    requestContext = {
      requireBandId: jest.fn().mockReturnValue(1),
      getBandId: jest.fn().mockReturnValue(1),
      getIdentity: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemberService,
        { provide: PrismaService, useValue: prisma },
        { provide: LogService, useValue: logService },
        { provide: RequestContextService, useValue: requestContext },
      ],
    }).compile();

    service = module.get<MemberService>(MemberService);
  });

  describe('findAll', () => {
    it('should return all members ordered by active then name', async () => {
      const members = [
        { id: 1, name: 'Alice', email: 'alice@test.com', oidcSub: 'sub1', active: true },
        { id: 2, name: 'Bob', email: null, oidcSub: null, active: false },
      ];
      prisma.member.findMany.mockResolvedValue(members);

      const result = await service.findAll();

      expect(prisma.member.findMany).toHaveBeenCalledWith({
        where: { bandId: 1 },
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 1, name: 'Alice', email: 'alice@test.com', oidcSub: 'sub1', active: true });
      expect(result[1]).toEqual({ id: 2, name: 'Bob', email: undefined, oidcSub: undefined, active: false });
    });

    it('should throw NotFoundException when no band is resolved', async () => {
      requestContext.requireBandId.mockImplementation(() => {
        throw new NotFoundException('Band not found');
      });

      await expect(service.findAll()).rejects.toThrow(NotFoundException);
      expect(prisma.member.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findByEmail', () => {
    it('should return member when found', async () => {
      prisma.member.findUnique.mockResolvedValue({ id: 1, name: 'Alice', email: 'alice@test.com', oidcSub: null, active: true });
      const result = await service.findByEmail('alice@test.com');
      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { bandId_email: { bandId: 1, email: 'alice@test.com' } },
      });
      expect(result).toEqual({ id: 1, name: 'Alice', email: 'alice@test.com', oidcSub: undefined, active: true });
    });

    it('should return null when not found', async () => {
      prisma.member.findUnique.mockResolvedValue(null);
      const result = await service.findByEmail('notfound@test.com');
      expect(result).toBeNull();
    });
  });

  describe('findByOidcSub', () => {
    it('should return member when found', async () => {
      prisma.member.findUnique.mockResolvedValue({ id: 1, name: 'Alice', email: 'alice@test.com', oidcSub: 'sub1', active: true });
      const result = await service.findByOidcSub('sub1');
      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { bandId_oidcSub: { bandId: 1, oidcSub: 'sub1' } },
      });
      expect(result).toEqual({ id: 1, name: 'Alice', email: 'alice@test.com', oidcSub: 'sub1', active: true });
    });

    it('should return null when not found', async () => {
      prisma.member.findUnique.mockResolvedValue(null);
      const result = await service.findByOidcSub('unknown');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a member successfully', async () => {
      prisma.member.findUnique.mockResolvedValue(null);
      prisma.member.create.mockResolvedValue({ id: 3, name: 'Charlie', email: 'c@test.com', oidcSub: null, active: true });

      const result = await service.create('Charlie', 'c@test.com');

      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { bandId_email: { bandId: 1, email: 'c@test.com' } },
      });
      expect(prisma.member.create).toHaveBeenCalledWith({
        data: { bandId: 1, name: 'Charlie', email: 'c@test.com', oidcSub: null },
      });
      expect(logService.log).toHaveBeenCalledWith('CREATE', 'member', 3, { name: 'Charlie', email: 'c@test.com' });
      expect(result.name).toBe('Charlie');
    });

    it('should throw when email already in use', async () => {
      prisma.member.findUnique.mockResolvedValue({ id: 1 });

      await expect(service.create('Test', 'existing@test.com'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw when oidcSub already in use', async () => {
      prisma.member.findUnique
        .mockResolvedValueOnce({ id: 1 }); // oidcSub check (email is undefined, so no email check)

      await expect(service.create('Test', undefined, 'existing-sub'))
        .rejects.toThrow(BadRequestException);
      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { bandId_oidcSub: { bandId: 1, oidcSub: 'existing-sub' } },
      });
    });
  });

  describe('update', () => {
    it('should update member name and email', async () => {
      prisma.member.findFirst.mockResolvedValue({ id: 1, name: 'Old', email: 'old@test.com', oidcSub: null, active: true });
      prisma.member.findUnique.mockResolvedValueOnce(null); // email unique check
      prisma.member.update.mockResolvedValue({ id: 1, name: 'New', email: 'new@test.com', oidcSub: null, active: true });

      const result = await service.update(1, 'New', 'new@test.com');

      expect(prisma.member.findFirst).toHaveBeenCalledWith({ where: { id: 1, bandId: 1 } });
      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { bandId_email: { bandId: 1, email: 'new@test.com' } },
      });
      expect(result.name).toBe('New');
      expect(logService.log).toHaveBeenCalledWith('UPDATE', 'member', 1, { name: 'New', email: 'new@test.com' });
    });

    it('should throw NotFoundException when member does not exist', async () => {
      prisma.member.findFirst.mockResolvedValue(null);
      await expect(service.update(999, 'Name')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when member belongs to another band', async () => {
      // findFirst scoped by bandId returns nothing for another band's member
      prisma.member.findFirst.mockResolvedValue(null);

      await expect(service.update(5, 'Name')).rejects.toThrow(NotFoundException);
      expect(prisma.member.findFirst).toHaveBeenCalledWith({ where: { id: 5, bandId: 1 } });
      expect(prisma.member.update).not.toHaveBeenCalled();
    });

    it('should throw when email is already used by another member', async () => {
      prisma.member.findFirst.mockResolvedValue({ id: 1, name: 'Me', email: 'me@test.com', oidcSub: null, active: true });
      prisma.member.findUnique.mockResolvedValueOnce({ id: 2, email: 'taken@test.com' });

      await expect(service.update(1, undefined, 'taken@test.com')).rejects.toThrow(BadRequestException);
    });
  });

  describe('toggleActive', () => {
    it('should toggle active status', async () => {
      prisma.member.findFirst.mockResolvedValue({ id: 1, name: 'Alice', active: true });
      prisma.member.update.mockResolvedValue({ id: 1, name: 'Alice', email: null, oidcSub: null, active: false });

      const result = await service.toggleActive(1);

      expect(prisma.member.findFirst).toHaveBeenCalledWith({ where: { id: 1, bandId: 1 } });
      expect(prisma.member.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { active: false } });
      expect(result.active).toBe(false);
      expect(logService.log).toHaveBeenCalledWith('TOGGLE_ACTIVE', 'member', 1, { active: false });
    });

    it('should throw NotFoundException when member not found', async () => {
      prisma.member.findFirst.mockResolvedValue(null);
      await expect(service.toggleActive(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('linkOidcSub', () => {
    it('should link oidcSub to member', async () => {
      prisma.member.findFirst.mockResolvedValue({ id: 1, name: 'Alice', oidcSub: null, active: true });
      prisma.member.findUnique.mockResolvedValueOnce(null); // no existing member with that oidcSub
      prisma.member.update.mockResolvedValue({ id: 1, name: 'Alice', email: null, oidcSub: 'new-sub', active: true });

      const result = await service.linkOidcSub(1, 'new-sub');

      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { bandId_oidcSub: { bandId: 1, oidcSub: 'new-sub' } },
      });
      expect(result.oidcSub).toBe('new-sub');
      expect(logService.log).toHaveBeenCalledWith('LINK_OIDC', 'member', 1, { oidcSub: 'new-sub' });
    });

    it('should throw when oidcSub belongs to another member', async () => {
      prisma.member.findFirst.mockResolvedValue({ id: 1, name: 'Alice' });
      prisma.member.findUnique.mockResolvedValueOnce({ id: 2, oidcSub: 'taken-sub' });

      await expect(service.linkOidcSub(1, 'taken-sub')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when member not found', async () => {
      prisma.member.findFirst.mockResolvedValue(null);
      await expect(service.linkOidcSub(999, 'sub')).rejects.toThrow(NotFoundException);
    });
  });
});
