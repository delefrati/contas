import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, StreamableFile } from '@nestjs/common';
import { BandController } from './band.controller';
import { BandService } from './band.service';
import { RequestContextService } from '../common/request-context.service';
import { LogService } from '../log/log.service';

describe('BandController', () => {
  let controller: BandController;
  let bandService: {
    slugFromHost: jest.Mock;
    findBySlug: jest.Mock;
    findById: jest.Mock;
    getLogo: jest.Mock;
    setLogo: jest.Mock;
    removeLogo: jest.Mock;
  };
  let logService: { log: jest.Mock };
  let requestContext: { requireBandId: jest.Mock; getBandId: jest.Mock; getIdentity: jest.Mock };

  beforeEach(async () => {
    bandService = {
      slugFromHost: jest.fn(),
      findBySlug: jest.fn(),
      findById: jest.fn(),
      getLogo: jest.fn(),
      setLogo: jest.fn(),
      removeLogo: jest.fn(),
    };
    logService = { log: jest.fn().mockResolvedValue({}) };
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
        { provide: LogService, useValue: logService },
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

  describe('logo', () => {
    const withLogo = { id: 1, slug: 'maverick', name: 'Maverick', logoUrl: '/api/band/logo?v=1' };

    it('should serve the logo with its stored type, cacheable for good', async () => {
      bandService.getLogo.mockResolvedValue({ data: Buffer.from('png-bytes'), type: 'image/png' });
      const res = { setHeader: jest.fn() };

      const result = await controller.logo(res as any);

      expect(result).toBeInstanceOf(StreamableFile);
      expect(result.getHeaders()).toEqual(expect.objectContaining({ type: 'image/png', length: 9 }));
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=31536000, immutable');
    });

    it('should answer an uncached 404 when the band has no logo', async () => {
      bandService.getLogo.mockResolvedValue(null);
      const res = { setHeader: jest.fn() };

      await expect(controller.logo(res as any)).rejects.toThrow(NotFoundException);
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('should store an uploaded logo for the current band and log it', async () => {
      bandService.setLogo.mockResolvedValue(withLogo);
      const buffer = Buffer.from('png-bytes');

      const result = await controller.uploadLogo({ buffer });

      expect(bandService.setLogo).toHaveBeenCalledWith(1, buffer);
      expect(logService.log).toHaveBeenCalledWith('UPDATE', 'band_logo', 1, { bytes: 9 });
      expect(result).toEqual({ data: withLogo });
    });

    it('should reject an upload without a file', async () => {
      await expect(controller.uploadLogo(undefined)).rejects.toThrow(BadRequestException);
      expect(bandService.setLogo).not.toHaveBeenCalled();
    });

    it('should remove the logo of the current band and log it', async () => {
      bandService.removeLogo.mockResolvedValue({ ...withLogo, logoUrl: null });

      const result = await controller.removeLogo();

      expect(bandService.removeLogo).toHaveBeenCalledWith(1);
      expect(logService.log).toHaveBeenCalledWith('DELETE', 'band_logo', 1);
      expect(result.data.logoUrl).toBeNull();
    });
  });
});
