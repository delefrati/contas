import { Test, TestingModule } from '@nestjs/testing';
import { LogController } from './log.controller';
import { LogService } from './log.service';

describe('LogController', () => {
  let controller: LogController;
  let logService: { findAll: jest.Mock; findByResource: jest.Mock; findByAction: jest.Mock };

  beforeEach(async () => {
    logService = {
      findAll: jest.fn(),
      findByResource: jest.fn(),
      findByAction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LogController],
      providers: [{ provide: LogService, useValue: logService }],
    }).compile();

    controller = module.get<LogController>(LogController);
  });

  describe('findAll', () => {
    it('should return logs with default limit', async () => {
      const logs = [{ id: 1, action: 'CREATE', resource: 'expense' }];
      logService.findAll.mockResolvedValue(logs);

      const result = await controller.findAll();

      expect(logService.findAll).toHaveBeenCalledWith(100);
      expect(result).toEqual({ data: logs });
    });

    it('should use custom limit', async () => {
      logService.findAll.mockResolvedValue([]);
      await controller.findAll('25');
      expect(logService.findAll).toHaveBeenCalledWith(25);
    });
  });

  describe('findByResource', () => {
    it('should filter by resource and resourceId', async () => {
      logService.findByResource.mockResolvedValue([]);
      const result = await controller.findByResource('expense', 5, '10');
      expect(logService.findByResource).toHaveBeenCalledWith('expense', 5, 10);
      expect(result).toEqual({ data: [] });
    });

    it('should use default limit when not provided', async () => {
      logService.findByResource.mockResolvedValue([]);
      await controller.findByResource('member', undefined);
      expect(logService.findByResource).toHaveBeenCalledWith('member', undefined, 50);
    });
  });

  describe('findByAction', () => {
    it('should filter by action', async () => {
      logService.findByAction.mockResolvedValue([]);
      const result = await controller.findByAction('LOGIN', '30');
      expect(logService.findByAction).toHaveBeenCalledWith('LOGIN', 30);
      expect(result).toEqual({ data: [] });
    });
  });
});
