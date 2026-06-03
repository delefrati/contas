import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ExpenseService } from './expense.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';

describe('ExpenseService', () => {
  let service: ExpenseService;
  let prisma: any;
  let logService: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      expense: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      expenseType: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      expenseMember: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      member: {
        findMany: jest.fn(),
      },
    };
    logService = { log: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseService,
        { provide: PrismaService, useValue: prisma },
        { provide: LogService, useValue: logService },
      ],
    }).compile();

    service = module.get<ExpenseService>(ExpenseService);
  });

  describe('create', () => {
    const validDto = { description: 'Groceries', typeId: 1, amount: 50.5, date: '2024-01-15', memberIds: [1, 2] };

    beforeEach(() => {
      prisma.expenseType.findUnique.mockResolvedValue({ id: 1, deletedAt: null });
      prisma.expense.create.mockResolvedValue({
        id: 1, description: 'Groceries', fkType: 1, amount: 50.5, date: '2024-01-15',
        fkMember: 1, createdAt: '2024-01-15T10:00:00.000Z', deletedAt: null,
        type: { id: 1, name: 'Food' },
        members: [
          { memberId: 1, member: { name: 'Alice' } },
          { memberId: 2, member: { name: 'Bob' } },
        ],
      });
    });

    it('should create expense with valid data', async () => {
      const result = await service.create(validDto);

      expect(result.id).toBe(1);
      expect(result.description).toBe('Groceries');
      expect(result.amount).toBe(50.5);
      expect(result.memberIds).toEqual([1, 2]);
      expect(result.members).toEqual(['Alice', 'Bob']);
      expect(logService.log).toHaveBeenCalledWith('CREATE', 'expense', 1, expect.any(Object));
    });

    it('should throw for empty description', async () => {
      await expect(service.create({ ...validDto, description: '' }))
        .rejects.toThrow(BadRequestException);
      await expect(service.create({ ...validDto, description: '   ' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw for invalid amount', async () => {
      await expect(service.create({ ...validDto, amount: NaN }))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw for zero amount', async () => {
      await expect(service.create({ ...validDto, amount: 0 }))
        .rejects.toThrow(BadRequestException);
    });

    it('should use first active type when typeId is not provided', async () => {
      prisma.expenseType.findFirst.mockResolvedValue({ id: 2 });
      prisma.expenseType.findUnique.mockResolvedValue({ id: 2, deletedAt: null });
      prisma.expense.create.mockResolvedValue({
        id: 2, description: 'Test', fkType: 2, amount: 10, date: '2024-01-15',
        fkMember: null, createdAt: '2024-01-15T10:00:00.000Z', deletedAt: null,
        type: { id: 2, name: 'Other' }, members: [],
      });
      prisma.member.findMany.mockResolvedValue([{ id: 1 }]);

      await service.create({ description: 'Test', amount: 10 });

      expect(prisma.expenseType.findFirst).toHaveBeenCalledWith({
        where: { deletedAt: null }, orderBy: { id: 'asc' }, select: { id: true },
      });
    });

    it('should throw when no active type available and typeId not provided', async () => {
      prisma.expenseType.findFirst.mockResolvedValue(null);

      await expect(service.create({ description: 'Test', amount: 10 }))
        .rejects.toThrow('No active expense type available.');
    });

    it('should throw for deleted expense type', async () => {
      prisma.expenseType.findUnique.mockResolvedValue({ id: 1, deletedAt: new Date() });

      await expect(service.create(validDto)).rejects.toThrow('Invalid expense type.');
    });

    it('should assign all active members when memberIds is empty', async () => {
      prisma.member.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
      prisma.expense.create.mockResolvedValue({
        id: 3, description: 'Shared', fkType: 1, amount: 30, date: '2024-01-15',
        fkMember: 1, createdAt: '2024-01-15T10:00:00.000Z', deletedAt: null,
        type: { id: 1, name: 'Food' },
        members: [
          { memberId: 1, member: { name: 'A' } },
          { memberId: 2, member: { name: 'B' } },
          { memberId: 3, member: { name: 'C' } },
        ],
      });

      await service.create({ ...validDto, memberIds: [] });

      expect(prisma.member.findMany).toHaveBeenCalledWith({ where: { active: true }, select: { id: true } });
    });

    it('should throw for invalid member id', async () => {
      await expect(service.create({ ...validDto, memberIds: [0] }))
        .rejects.toThrow('Invalid member in the list sent.');
    });

    it('should round amount to 2 decimal places', async () => {
      prisma.expense.create.mockResolvedValue({
        id: 4, description: 'Test', fkType: 1, amount: 10.13, date: '2024-01-15',
        fkMember: 1, createdAt: '2024-01-15T10:00:00.000Z', deletedAt: null,
        type: { id: 1, name: 'Food' }, members: [{ memberId: 1, member: { name: 'A' } }],
      });

      await service.create({ ...validDto, amount: 10.126 });

      expect(prisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 10.13 }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return non-deleted expenses', async () => {
      prisma.expense.findMany.mockResolvedValue([
        {
          id: 1, description: 'Test', fkType: 1, amount: 25, date: '2024-01-10',
          fkMember: 1, createdAt: new Date('2024-01-10'), deletedAt: null,
          type: { id: 1, name: 'Food' },
          members: [{ memberId: 1, member: { name: 'Alice' } }],
        },
      ]);

      const result = await service.findAll();

      expect(prisma.expense.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        include: { type: true, members: { include: { member: true } } },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].typeName).toBe('Food');
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.expense.findUnique.mockResolvedValue({ id: 1, deletedAt: null });
      prisma.expense.update.mockResolvedValue({});
    });

    it('should throw when expense not found', async () => {
      prisma.expense.findUnique.mockResolvedValue(null);
      await expect(service.update(999, { description: 'New' })).rejects.toThrow('Expense not found.');
    });

    it('should throw when expense is deleted', async () => {
      prisma.expense.findUnique.mockResolvedValue({ id: 1, deletedAt: new Date() });
      await expect(service.update(1, { description: 'New' })).rejects.toThrow('Expense not found.');
    });

    it('should throw for empty description', async () => {
      await expect(service.update(1, { description: '  ' })).rejects.toThrow('Description is required.');
    });

    it('should throw for invalid amount', async () => {
      await expect(service.update(1, { amount: 0 })).rejects.toThrow('Invalid amount.');
    });

    it('should throw for invalid date format', async () => {
      await expect(service.update(1, { date: '01-15-2024' })).rejects.toThrow('Invalid date format.');
    });

    it('should throw for deleted expense type', async () => {
      prisma.expenseType.findUnique.mockResolvedValue({ id: 2, deletedAt: new Date() });
      await expect(service.update(1, { typeId: 2 })).rejects.toThrow('Invalid expense type.');
    });

    it('should update memberIds when provided', async () => {
      prisma.expense.findUnique
        .mockResolvedValueOnce({ id: 1, deletedAt: null })
        .mockResolvedValueOnce({
          id: 1, description: 'Test', fkType: 1, amount: 10, date: '2024-01-15',
          fkMember: 3, createdAt: '2024-01-15T10:00:00.000Z', deletedAt: null,
          type: { id: 1, name: 'Food' }, members: [{ memberId: 3, member: { name: 'Charlie' } }],
        });

      await service.update(1, { memberIds: [3] });

      expect(prisma.expenseMember.deleteMany).toHaveBeenCalledWith({ where: { expenseId: 1 } });
      expect(prisma.expenseMember.createMany).toHaveBeenCalledWith({
        data: [{ expenseId: 1, memberId: 3 }],
      });
    });
  });

  describe('delete', () => {
    it('should soft delete an expense', async () => {
      prisma.expense.findUnique.mockResolvedValue({ id: 1, description: 'Test', amount: 50 });
      prisma.expense.update.mockResolvedValue({});

      await service.delete(1);

      expect(prisma.expense.update).toHaveBeenCalledWith({
        where: { id: 1 }, data: { deletedAt: expect.any(Date) },
      });
      expect(logService.log).toHaveBeenCalledWith('DELETE', 'expense', 1, { description: 'Test', amount: 50 });
    });
  });

  describe('reportByMember', () => {
    it('should calculate member totals with shared expenses', async () => {
      prisma.member.findMany.mockResolvedValue([
        { id: 1, name: 'Alice', active: true },
        { id: 2, name: 'Bob', active: true },
      ]);
      prisma.expenseMember.findMany
        .mockResolvedValueOnce([{ memberId: 1, expenseId: 1 }]) // Alice
        .mockResolvedValueOnce([{ memberId: 2, expenseId: 1 }]); // Bob
      prisma.expense.findUnique
        .mockResolvedValue({ id: 1, amount: 100, deletedAt: null });
      prisma.expenseMember.count.mockResolvedValue(2);

      const result = await service.reportByMember();

      expect(result).toHaveLength(2);
      expect(result[0].total).toBe(50); // 100 / 2 members
      expect(result[1].total).toBe(50);
    });

    it('should skip deleted expenses in report', async () => {
      prisma.member.findMany.mockResolvedValue([{ id: 1, name: 'Alice', active: true }]);
      prisma.expenseMember.findMany.mockResolvedValue([{ memberId: 1, expenseId: 1 }]);
      prisma.expense.findUnique.mockResolvedValue({ id: 1, amount: 100, deletedAt: new Date() });

      const result = await service.reportByMember();

      expect(result[0].total).toBe(0);
    });
  });
});
