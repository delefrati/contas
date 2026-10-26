import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BandController } from './band.controller';
import { BandService } from './band.service';
import { RequestContextService } from '../common/request-context.service';

describe('BandController', () => {
  let controller: BandController;
  let bandService: { slugFromHost: jest.Mock; findBySlug: jest.Mock; findById: jest.Mock };
  let requestContext: { requireBandId: jest.Mock; getBandId: jest.Mock; getIdentity: jest.Mock };

  beforeEach(async () => {
    bandService = {
      slugFromHost: jest.fn(),
      findBySlug: jest.fn(),
      findById: jest.fn(),
    };
    requestContext = {
      requireBandId: jest.fn().mockReturnValue(1),
      getBandId: jest.fn().mockReturnValue(1),
      getIdentity: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BandController],
      providers: [
        { provide: BandService, useValue: bandService },
        { provide: RequestContextService, useValue: requestContext },
      ],
    }).compile();

    controller = module.get<BandController>(BandController);
  });

  describe('current', () => {
    it('should return the band of the current request', async () => {
      const band = { id: 1, slug: 'maverick', name: 'Maverick' };
      bandService.findById.mockResolvedValue(band);

      const result = await controller.current();

      expect(bandService.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual({ data: band });
    });

    it('should throw NotFoundException when the band no longer exists', async () => {
      bandService.findById.mockResolvedValue(null);

      await expect(controller.current()).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when no band is resolved for the request', async () => {
      requestContext.requireBandId.mockImplementation(() => {
        throw new NotFoundException('Band not found');
      });

      await expect(controller.current()).rejects.toThrow(NotFoundException);
      expect(bandService.findById).not.toHaveBeenCalled();
    });
  });

  describe('tlsCheck', () => {
    it('should return ok for an existing band domain', async () => {
      bandService.slugFromHost.mockReturnValue('maverick');
      bandService.findBySlug.mockResolvedValue({ id: 1, slug: 'maverick', name: 'Maverick' });

      const result = await controller.tlsCheck('maverick.minhabanda.com');

      expect(bandService.slugFromHost).toHaveBeenCalledWith('maverick.minhabanda.com');
      expect(bandService.findBySlug).toHaveBeenCalledWith('maverick');
      expect(result).toEqual({ status: 'ok' });
    });

    it('should throw NotFoundException for an unknown band', async () => {
      bandService.slugFromHost.mockReturnValue('ghost');
      bandService.findBySlug.mockResolvedValue(null);

      await expect(controller.tlsCheck('ghost.minhabanda.com')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for a domain outside BASE_DOMAIN', async () => {
      bandService.slugFromHost.mockReturnValue(undefined);

      await expect(controller.tlsCheck('evil.example.com')).rejects.toThrow(NotFoundException);
      expect(bandService.findBySlug).not.toHaveBeenCalled();
    });
  });
});
