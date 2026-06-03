import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseController } from './expense.controller';
import { ExpenseService } from './expense.service';

describe('ExpenseController', () => {
  let controller: ExpenseController;
  let expenseService: {
    create: jest.Mock; findAll: jest.Mock; update: jest.Mock;
    delete: jest.Mock; reportByMember: jest.Mock;
  };

  beforeEach(async () => {
    expenseService = {
      create: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      reportByMember: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpenseController],
      providers: [{ provide: ExpenseService, useValue: expenseService }],
    }).compile();

    controller = module.get<ExpenseController>(ExpenseController);
  });

  describe('create', () => {
    it('should create an expense and return wrapped in data', async () => {
      const expense = { id: 1, description: 'Test', amount: 50 };
      expenseService.create.mockResolvedValue(expense);

      const result = await controller.create({ description: 'Test', amount: 50 });

      expect(expenseService.create).toHaveBeenCalledWith({ description: 'Test', amount: 50 });
      expect(result).toEqual({ data: expense });
    });
  });

  describe('list', () => {
    it('should return all expenses wrapped in data', async () => {
      const expenses = [{ id: 1 }, { id: 2 }];
      expenseService.findAll.mockResolvedValue(expenses);

      const result = await controller.list();

      expect(result).toEqual({ data: expenses });
    });
  });

  describe('reportByMember', () => {
    it('should return report data', async () => {
      const report = [{ id: 1, name: 'Alice', total: 100 }];
      expenseService.reportByMember.mockResolvedValue(report);

      const result = await controller.reportByMember();

      expect(result).toEqual({ data: report });
    });
  });

  describe('update', () => {
    it('should update expense by id', async () => {
      const expense = { id: 1, description: 'Updated' };
      expenseService.update.mockResolvedValue(expense);

      const result = await controller.update(1, { description: 'Updated' });

      expect(expenseService.update).toHaveBeenCalledWith(1, { description: 'Updated' });
      expect(result).toEqual({ data: expense });
    });
  });

  describe('delete', () => {
    it('should delete expense by id', async () => {
      expenseService.delete.mockResolvedValue(undefined);

      await controller.delete(1);

      expect(expenseService.delete).toHaveBeenCalledWith(1);
    });
  });
});
