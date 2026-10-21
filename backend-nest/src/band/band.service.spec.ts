import { Test, TestingModule } from '@nestjs/testing';
import { BandService } from './band.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BandService', () => {
  let service: BandService;
  let prisma: { band: { findUnique: jest.Mock } };
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env.BASE_DOMAIN = 'minhabanda.com';
    delete process.env.DEFAULT_BAND;

    prisma = { band: { findUnique: jest.fn() } };

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
      prisma.band.findUnique.mockResolvedValue({ id: 1, slug: 'maverick', name: 'Maverick', createdAt: new Date() });

      const result = await service.findBySlug('maverick');

      expect(prisma.band.findUnique).toHaveBeenCalledWith({ where: { slug: 'maverick' } });
      expect(result).toEqual({ id: 1, slug: 'maverick', name: 'Maverick' });
    });

    it('should return null when not found', async () => {
      prisma.band.findUnique.mockResolvedValue(null);
      expect(await service.findBySlug('ghost')).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return the band dto when found', async () => {
      prisma.band.findUnique.mockResolvedValue({ id: 2, slug: 'other', name: 'Other' });

      const result = await service.findById(2);

      expect(prisma.band.findUnique).toHaveBeenCalledWith({ where: { id: 2 } });
      expect(result).toEqual({ id: 2, slug: 'other', name: 'Other' });
    });

    it('should return null when not found', async () => {
      prisma.band.findUnique.mockResolvedValue(null);
      expect(await service.findById(99)).toBeNull();
    });
  });
});
