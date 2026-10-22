import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EventTypeService } from './event-type.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { RequestContextService } from '../common/request-context.service';

describe('EventTypeService', () => {
  let service: EventTypeService;
  let prisma: {
    eventType: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let logService: { log: jest.Mock };

  const party = { id: 3, bandId: 1, name: 'Confraternização', color: '#ed8936', deletedAt: null };

  beforeEach(async () => {
    prisma = {
      eventType: {
        findMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 3, deletedAt: null, ...data })),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ ...party, id: where.id, ...data })),
      },
    };
    logService = { log: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventTypeService,
        { provide: PrismaService, useValue: prisma },
        { provide: LogService, useValue: logService },
        { provide: RequestContextService, useValue: { requireBandId: jest.fn().mockReturnValue(1) } },
      ],
    }).compile();

    service = module.get<EventTypeService>(EventTypeService);
  });

  describe('findAll', () => {
    it('should list the band active types by name', async () => {
      prisma.eventType.findMany.mockResolvedValue([party]);

      const result = await service.findAll();

      expect(prisma.eventType.findMany).toHaveBeenCalledWith({
        where: { bandId: 1, deletedAt: null },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([{ id: 3, name: 'Confraternização', color: '#ed8936', deletedAt: null }]);
    });

    it('should include deleted types when asked', async () => {
      prisma.eventType.findMany.mockResolvedValue([]);

      await service.findAll(true);

      expect(prisma.eventType.findMany.mock.calls[0][0].where).toEqual({ bandId: 1 });
    });
  });

  describe('create', () => {
    it('should create a type with a trimmed name and lowercase color', async () => {
      const result = await service.create({ name: '  Encontro ', color: '#38B2AC' });

      expect(prisma.eventType.create).toHaveBeenCalledWith({
        data: { bandId: 1, name: 'Encontro', color: '#38b2ac' },
      });
      expect(result.name).toBe('Encontro');
      expect(logService.log).toHaveBeenCalledWith('CREATE', 'eventType', 3, { name: 'Encontro' });
    });

    it('should use the default color when none is given', async () => {
      await service.create({ name: 'Encontro' });

      expect(prisma.eventType.create.mock.calls[0][0].data.color).toBe('#667eea');
    });

    it('should restore a deleted type with the same name', async () => {
      prisma.eventType.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...party, deletedAt: new Date() });

      await service.create({ name: 'Confraternização', color: '#ed8936' });

      expect(prisma.eventType.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { deletedAt: null, color: '#ed8936' },
      });
      expect(prisma.eventType.create).not.toHaveBeenCalled();
      expect(logService.log).toHaveBeenCalledWith('RESTORE', 'eventType', 3, expect.any(Object));
    });

    it('should reject duplicates, empty names and invalid colors', async () => {
      prisma.eventType.findFirst.mockResolvedValueOnce(party);
      await expect(service.create({ name: 'Confraternização' })).rejects.toThrow(ConflictException);
      await expect(service.create({ name: '  ' })).rejects.toThrow(BadRequestException);
      await expect(service.create({ name: 'Encontro', color: 'red' })).rejects.toThrow(BadRequestException);
      expect(prisma.eventType.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should rename and recolor a type', async () => {
      prisma.eventType.findFirst.mockResolvedValueOnce(party).mockResolvedValueOnce(null);

      const result = await service.update(3, { name: 'Festa', color: '#d53f8c' });

      expect(prisma.eventType.findFirst).toHaveBeenLastCalledWith({
        where: { bandId: 1, name: 'Festa', deletedAt: null, id: { not: 3 } },
      });
      expect(prisma.eventType.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { name: 'Festa', color: '#d53f8c' },
      });
      expect(result.name).toBe('Festa');
    });

    it('should not rename to the name of another type', async () => {
      prisma.eventType.findFirst.mockResolvedValueOnce(party).mockResolvedValueOnce({ id: 1 });

      await expect(service.update(3, { name: 'Show' })).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for deleted types', async () => {
      prisma.eventType.findFirst.mockResolvedValueOnce({ ...party, deletedAt: new Date() });

      await expect(service.update(3, { name: 'Festa' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should mark the type as deleted', async () => {
      prisma.eventType.findFirst.mockResolvedValueOnce(party);

      await service.softDelete(3);

      expect(prisma.eventType.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException for types of another band', async () => {
      await expect(service.softDelete(3)).rejects.toThrow(NotFoundException);
    });
  });
});
