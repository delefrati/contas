import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BandService } from './band.service';
import { PrismaService } from '../prisma/prisma.service';

// The per-request band lookup must never load the logo bytes
const BAND_SELECT = { id: true, slug: true, name: true, logoUpdatedAt: true };

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]);

describe('BandService', () => {
  let service: BandService;
  let prisma: { band: { findUnique: jest.Mock; update: jest.Mock } };
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env.BASE_DOMAIN = 'minhabanda.com';
    delete process.env.DEFAULT_BAND;

    prisma = { band: { findUnique: jest.fn(), update: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BandService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<BandService>(BandService);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('slugFromHost', () => {
    it('should extract the slug from a subdomain of BASE_DOMAIN', () => {
      expect(service.slugFromHost('maverick.minhabanda.com')).toBe('maverick');
    });

    it('should ignore the port and letter case', () => {
      expect(service.slugFromHost('Maverick.MinhaBanda.com:8443')).toBe('maverick');
    });

    it('should return undefined for the bare base domain', () => {
      expect(service.slugFromHost('minhabanda.com')).toBeUndefined();
    });

    it('should return undefined for hosts outside BASE_DOMAIN', () => {
      expect(service.slugFromHost('maverick.example.com')).toBeUndefined();
      expect(service.slugFromHost('evilminhabanda.com')).toBeUndefined();
    });

    it('should return undefined for nested or invalid subdomains', () => {
      expect(service.slugFromHost('a.b.minhabanda.com')).toBeUndefined();
      expect(service.slugFromHost('bad_slug.minhabanda.com')).toBeUndefined();
    });

    it('should return undefined when host is missing', () => {
      expect(service.slugFromHost(undefined)).toBeUndefined();
      expect(service.slugFromHost('')).toBeUndefined();
    });

    it('should return undefined when BASE_DOMAIN is not set', () => {
      delete process.env.BASE_DOMAIN;
      expect(service.slugFromHost('maverick.minhabanda.com')).toBeUndefined();
    });
  });

  describe('resolveSlug', () => {
    it('should prefer the slug from the host', () => {
      process.env.DEFAULT_BAND = 'fallback';
      expect(service.resolveSlug('maverick.minhabanda.com')).toBe('maverick');
    });

    it('should fall back to DEFAULT_BAND for hosts outside BASE_DOMAIN', () => {
      process.env.DEFAULT_BAND = 'fallback';
      expect(service.resolveSlug('localhost:3000')).toBe('fallback');
    });

    it('should return undefined when nothing matches and DEFAULT_BAND is unset', () => {
      expect(service.resolveSlug('localhost:3000')).toBeUndefined();
    });

    it('should treat an empty DEFAULT_BAND as unset', () => {
      process.env.DEFAULT_BAND = '';
      expect(service.resolveSlug('localhost')).toBeUndefined();
    });
  });

  describe('findBySlug', () => {
    it('should return the band dto when found', async () => {
      prisma.band.findUnique.mockResolvedValue({ id: 1, slug: 'maverick', name: 'Maverick', logoUpdatedAt: null });

      const result = await service.findBySlug('maverick');

      expect(prisma.band.findUnique).toHaveBeenCalledWith({ where: { slug: 'maverick' }, select: BAND_SELECT });
      expect(result).toEqual({ id: 1, slug: 'maverick', name: 'Maverick', logoUrl: null });
    });

    it('should return null when not found', async () => {
      prisma.band.findUnique.mockResolvedValue(null);
      expect(await service.findBySlug('ghost')).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return the band dto when found', async () => {
      prisma.band.findUnique.mockResolvedValue({ id: 2, slug: 'other', name: 'Other', logoUpdatedAt: null });

      const result = await service.findById(2);

      expect(prisma.band.findUnique).toHaveBeenCalledWith({ where: { id: 2 }, select: BAND_SELECT });
      expect(result).toEqual({ id: 2, slug: 'other', name: 'Other', logoUrl: null });
    });

    it('should version the logo URL with its upload time', async () => {
      prisma.band.findUnique.mockResolvedValue({
        id: 2, slug: 'other', name: 'Other', logoUpdatedAt: new Date(1700000000000),
      });

      expect((await service.findById(2))?.logoUrl).toBe('/api/band/logo?v=1700000000000');
    });

    it('should return null when not found', async () => {
      prisma.band.findUnique.mockResolvedValue(null);
      expect(await service.findById(99)).toBeNull();
    });
  });

  describe('getLogo', () => {
    it('should return the stored bytes and type', async () => {
      prisma.band.findUnique.mockResolvedValue({ logo: PNG, logoType: 'image/png' });

      expect(await service.getLogo(1)).toEqual({ data: PNG, type: 'image/png' });
      expect(prisma.band.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { logo: true, logoType: true },
      });
    });

    it('should return null when the band has no logo', async () => {
      prisma.band.findUnique.mockResolvedValue({ logo: null, logoType: null });
      expect(await service.getLogo(1)).toBeNull();
    });
  });

  describe('setLogo', () => {
    beforeEach(() => {
      prisma.band.update.mockResolvedValue({
        id: 1, slug: 'maverick', name: 'Maverick', logoUpdatedAt: new Date(1700000000000),
      });
    });

    it.each([
      ['PNG', PNG, 'image/png'],
      ['JPEG', JPEG, 'image/jpeg'],
      ['WebP', WEBP, 'image/webp'],
    ])('should store a %s with the type read from its bytes', async (_name, data, type) => {
      const result = await service.setLogo(1, data);

      expect(prisma.band.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { logo: data, logoType: type, logoUpdatedAt: expect.any(Date) },
        select: BAND_SELECT,
      });
      expect(result.logoUrl).toBe('/api/band/logo?v=1700000000000');
    });

    it('should reject an SVG, which can carry scripts', async () => {
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      await expect(service.setLogo(1, svg)).rejects.toThrow('Logo must be a PNG, JPEG or WebP image');
      expect(prisma.band.update).not.toHaveBeenCalled();
    });

    it('should reject a file that only claims to be an image', async () => {
      await expect(service.setLogo(1, Buffer.from('not really a png'))).rejects.toThrow(BadRequestException);
    });

    it('should reject a logo over 1 MB', async () => {
      const big = Buffer.concat([PNG, Buffer.alloc(1024 * 1024)]);
      await expect(service.setLogo(1, big)).rejects.toThrow('Logo must be at most 1 MB');
    });
  });

  describe('removeLogo', () => {
    it('should clear the logo', async () => {
      prisma.band.update.mockResolvedValue({ id: 1, slug: 'maverick', name: 'Maverick', logoUpdatedAt: null });

      const result = await service.removeLogo(1);

      expect(prisma.band.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { logo: null, logoType: null, logoUpdatedAt: null },
        select: BAND_SELECT,
      });
      expect(result.logoUrl).toBeNull();
    });
  });
});
