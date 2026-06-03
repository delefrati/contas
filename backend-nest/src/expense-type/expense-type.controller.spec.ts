import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseTypeController } from './expense-type.controller';
import { ExpenseTypeService } from './expense-type.service';

describe('ExpenseTypeController', () => {
  let controller: ExpenseTypeController;
  let expenseTypeService: { findAll: jest.Mock; create: jest.Mock; softDelete: jest.Mock };

  beforeEach(async () => {
    expenseTypeService = {
      findAll: jest.fn(),
      create: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpenseTypeController],
      providers: [{ provide: ExpenseTypeService, useValue: expenseTypeService }],
    }).compile();

    controller = module.get<ExpenseTypeController>(ExpenseTypeController);
  });

  describe('list', () => {
    it('should return types without deleted by default', async () => {
      const types = [{ id: 1, name: 'Food', deletedAt: null }];
      expenseTypeService.findAll.mockResolvedValue(types);

      const result = await controller.list();

      expect(expenseTypeService.findAll).toHaveBeenCalledWith(false);
      expect(result).toEqual({ data: types });
    });

    it('should include deleted when query param is true', async () => {
      expenseTypeService.findAll.mockResolvedValue([]);
      await controller.list('true');
      expect(expenseTypeService.findAll).toHaveBeenCalledWith(true);
    });
  });

  describe('create', () => {
    it('should create and return a new type', async () => {
      const type = { id: 2, name: 'Transport', deletedAt: null };
      expenseTypeService.create.mockResolvedValue(type);

      const result = await controller.create({ name: 'Transport' });

      expect(expenseTypeService.create).toHaveBeenCalledWith({ name: 'Transport' });
      expect(result).toEqual({ data: type });
    });
  });

  describe('delete', () => {
    it('should soft delete a type', async () => {
      expenseTypeService.softDelete.mockResolvedValue(undefined);

      await controller.delete(1);

      expect(expenseTypeService.softDelete).toHaveBeenCalledWith(1);
    });
  });
});
