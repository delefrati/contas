import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ExpenseTypeService } from './expense-type.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';

describe('ExpenseTypeService', () => {
  let service: ExpenseTypeService;
  let prisma: { expenseType: { findMany: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock } };
  let logService: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      expenseType: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    logService = { log: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseTypeService,
        { provide: PrismaService, useValue: prisma },
        { provide: LogService, useValue: logService },
      ],
    }).compile();

    service = module.get<ExpenseTypeService>(ExpenseTypeService);
  });

  describe('findAll', () => {
    it('should return only active types by default', async () => {
      const types = [
        { id: 1, name: 'Food', deletedAt: null },
        { id: 2, name: 'Transport', deletedAt: null },
      ];
      prisma.expenseType.findMany.mockResolvedValue(types);

      const result = await service.findAll();

      expect(prisma.expenseType.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 1, name: 'Food', deletedAt: null });
    });

    it('should include deleted types when requested', async () => {
      const types = [
        { id: 1, name: 'Food', deletedAt: null },
        { id: 2, name: 'Old', deletedAt: new Date('2024-01-01') },
      ];
      prisma.expenseType.findMany.mockResolvedValue(types);

      const result = await service.findAll(true);

      expect(prisma.expenseType.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { name: 'asc' },
      });
      expect(result).toHaveLength(2);
      expect(result[1].deletedAt).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  describe('create', () => {
    it('should create a new expense type', async () => {
      prisma.expenseType.findFirst
        .mockResolvedValueOnce(null) // no active type with this name
        .mockResolvedValueOnce(null); // no deleted type either
      prisma.expenseType.create.mockResolvedValue({ id: 3, name: 'Utilities', deletedAt: null });

      const result = await service.create({ name: 'Utilities' });

      expect(prisma.expenseType.create).toHaveBeenCalledWith({ data: { name: 'Utilities' } });
      expect(logService.log).toHaveBeenCalledWith('CREATE', 'expenseType', 3, { name: 'Utilities' });
      expect(result).toEqual({ id: 3, name: 'Utilities', deletedAt: null });
    });

    it('should restore a previously deleted type', async () => {
      prisma.expenseType.findFirst
        .mockResolvedValueOnce(null) // no active match
        .mockResolvedValueOnce({ id: 5, name: 'Old', deletedAt: new Date() }); // found deleted
      prisma.expenseType.update.mockResolvedValue({ id: 5, name: 'Old', deletedAt: null });

      const result = await service.create({ name: 'Old' });

      expect(prisma.expenseType.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { deletedAt: null } });
      expect(logService.log).toHaveBeenCalledWith('RESTORE', 'expenseType', 5, { name: 'Old' });
      expect(result).toEqual({ id: 5, name: 'Old', deletedAt: null });
    });

    it('should throw ConflictException when active type with same name exists', async () => {
      prisma.expenseType.findFirst.mockResolvedValueOnce({ id: 1, name: 'Food' });

      await expect(service.create({ name: 'Food' })).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for empty name', async () => {
      await expect(service.create({ name: '' })).rejects.toThrow(BadRequestException);
      await expect(service.create({ name: '   ' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('softDelete', () => {
    it('should soft delete an existing active type', async () => {
      prisma.expenseType.findUnique.mockResolvedValue({ id: 1, name: 'Food', deletedAt: null });
      prisma.expenseType.update.mockResolvedValue({ id: 1, name: 'Food', deletedAt: new Date() });

      await service.softDelete(1);

      expect(prisma.expenseType.update).toHaveBeenCalledWith({
        where: { id: 1 }, data: { deletedAt: expect.any(Date) },
      });
      expect(logService.log).toHaveBeenCalledWith('DELETE', 'expenseType', 1, { name: 'Food' });
    });

    it('should do nothing if type is already deleted', async () => {
      prisma.expenseType.findUnique.mockResolvedValue({ id: 1, name: 'Food', deletedAt: new Date() });

      await service.softDelete(1);

      expect(prisma.expenseType.update).not.toHaveBeenCalled();
      expect(logService.log).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when type does not exist', async () => {
      prisma.expenseType.findUnique.mockResolvedValue(null);

      await expect(service.softDelete(999)).rejects.toThrow(NotFoundException);
    });
  });
});
