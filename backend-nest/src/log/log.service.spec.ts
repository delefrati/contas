import { Test, TestingModule } from '@nestjs/testing';
import { LogService } from './log.service';
import { PrismaService } from '../prisma/prisma.service';
import { RequestContextService } from '../common/request-context.service';

describe('LogService', () => {
  let service: LogService;
  let prisma: { log: { create: jest.Mock; findMany: jest.Mock } };
  let requestContext: { getMemberId: jest.Mock };

  beforeEach(async () => {
    prisma = {
      log: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };
    requestContext = { getMemberId: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogService,
        { provide: PrismaService, useValue: prisma },
        { provide: RequestContextService, useValue: requestContext },
      ],
    }).compile();

    service = module.get<LogService>(LogService);
  });

  describe('log', () => {
    it('should create a log entry with explicit userId', async () => {
      const createdLog = {
        id: 1, action: 'CREATE', resource: 'expense', resourceId: 5,
        details: '{"amount":100}', createdAt: new Date(), userId: 10,
      };
      prisma.log.create.mockResolvedValue(createdLog);

      const result = await service.log('CREATE', 'expense', 5, { amount: 100 }, 10);

      expect(prisma.log.create).toHaveBeenCalledWith({
        data: {
          action: 'CREATE', resource: 'expense', resourceId: 5,
          details: '{"amount":100}', userId: 10,
        },
      });
      expect(result.id).toBe(1);
      expect(result.action).toBe('CREATE');
    });

    it('should use requestContext memberId when userId not provided', async () => {
      requestContext.getMemberId.mockReturnValue(7);
      const createdLog = {
        id: 2, action: 'UPDATE', resource: 'member', resourceId: 3,
        details: null, createdAt: new Date(), userId: 7,
      };
      prisma.log.create.mockResolvedValue(createdLog);

      const result = await service.log('UPDATE', 'member', 3, undefined);

      expect(prisma.log.create).toHaveBeenCalledWith({
        data: {
          action: 'UPDATE', resource: 'member', resourceId: 3,
          details: null, userId: 7,
        },
      });
      expect(result.userId).toBe(7);
    });

    it('should handle null details', async () => {
      requestContext.getMemberId.mockReturnValue(undefined);
      const createdLog = {
        id: 3, action: 'DELETE', resource: 'expense', resourceId: 1,
        details: null, createdAt: new Date(), userId: null,
      };
      prisma.log.create.mockResolvedValue(createdLog);

      const result = await service.log('DELETE', 'expense', 1, null);

      expect(result.details).toBeUndefined();
      expect(result.userId).toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('should return logs with default limit', async () => {
      const logs = [
        { id: 1, action: 'CREATE', resource: 'expense', resourceId: 1, details: null, createdAt: new Date(), userId: 1, user: { name: 'John' } },
        { id: 2, action: 'UPDATE', resource: 'member', resourceId: 2, details: '{}', createdAt: new Date(), userId: 2, user: { name: 'Jane' } },
      ];
      prisma.log.findMany.mockResolvedValue(logs);

      const result = await service.findAll();

      expect(prisma.log.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' }, take: 100,
        include: { user: { select: { name: true } } },
      });
      expect(result).toHaveLength(2);
      expect(result[0].userName).toBe('John');
    });

    it('should respect custom limit', async () => {
      prisma.log.findMany.mockResolvedValue([]);
      await service.findAll(10);
      expect(prisma.log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });

  describe('findByResource', () => {
    it('should filter by resource only', async () => {
      prisma.log.findMany.mockResolvedValue([]);
      await service.findByResource('expense');

      expect(prisma.log.findMany).toHaveBeenCalledWith({
        where: { resource: 'expense' },
        orderBy: { createdAt: 'desc' }, take: 50,
        include: { user: { select: { name: true } } },
      });
    });

    it('should filter by resource and resourceId', async () => {
      prisma.log.findMany.mockResolvedValue([]);
      await service.findByResource('expense', 5, 25);

      expect(prisma.log.findMany).toHaveBeenCalledWith({
        where: { resource: 'expense', resourceId: 5 },
        orderBy: { createdAt: 'desc' }, take: 25,
        include: { user: { select: { name: true } } },
      });
    });
  });

  describe('findByAction', () => {
    it('should filter by action', async () => {
      prisma.log.findMany.mockResolvedValue([]);
      await service.findByAction('LOGIN', 20);

      expect(prisma.log.findMany).toHaveBeenCalledWith({
        where: { action: 'LOGIN' },
        orderBy: { createdAt: 'desc' }, take: 20,
        include: { user: { select: { name: true } } },
      });
    });
  });
});
