import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export class BandDto {
  id!: number;
  slug!: string;
  name!: string;
  // Versioned URL of the uploaded logo, or null when the band has none
  logoUrl!: string | null;
  // IANA zone the band's event times are in, e.g. America/Sao_Paulo
  timeZone!: string;
  // How long calendar apps show an event that has a start time but no end
  defaultEventMinutes!: number;
}

export interface CalendarSettings {
  timeZone?: string;
  defaultEventMinutes?: number;
}

export const MAX_LOGO_BYTES = 1024 * 1024;

// From 15 minutes to a whole day
export const MIN_EVENT_MINUTES = 15;
export const MAX_EVENT_MINUTES = 24 * 60;

// Any zone the runtime's time zone database knows
export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

// Subdomains that can never be a band
const RESERVED_SLUGS = ['www', 'api', 'app', 'admin', 'mail', 'static'];

// A valid DNS label: lowercase letters, digits and hyphens, not at the start or end
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(slug) && !RESERVED_SLUGS.includes(slug);
}

// Recognised by their leading bytes, never by the client's filename or declared type.
// SVG is left out on purpose: it can carry scripts.
const LOGO_SIGNATURES: { type: string; matches: (b: Buffer) => boolean }[] = [
  { type: 'image/png', matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: 'image/jpeg', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/webp', matches: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
];

// Everything but the logo bytes, which only the logo endpoint needs
const BAND_FIELDS = {
  id: true,
  slug: true,
  name: true,
  logoUpdatedAt: true,
  timeZone: true,
  defaultEventMinutes: true,
} as const;

function toBandDto(band: {
  id: number;
  slug: string;
  name: string;
  logoUpdatedAt: Date | null;
  timeZone: string;
  defaultEventMinutes: number;
}): BandDto {
  return {
    id: band.id,
    slug: band.slug,
    name: band.name,
    logoUrl: band.logoUpdatedAt ? `/api/band/logo?v=${band.logoUpdatedAt.getTime()}` : null,
    timeZone: band.timeZone,
    defaultEventMinutes: band.defaultEventMinutes,
  };
}

@Injectable()
export class BandService {
  constructor(private prisma: PrismaService) {}

  // "maverick.minhabanda.com" -> "maverick" when BASE_DOMAIN=minhabanda.com
  slugFromHost(host?: string): string | undefined {
    const hostname = (host || '').split(':')[0].toLowerCase();
    const baseDomain = (process.env.BASE_DOMAIN || '').toLowerCase();
    if (!baseDomain || !hostname.endsWith(`.${baseDomain}`)) {
      return undefined;
    }
    const slug = hostname.slice(0, -(baseDomain.length + 1));
    return /^[a-z0-9-]+$/.test(slug) ? slug : undefined;
  }

  // The admin panel lives on BASE_DOMAIN itself; without one (local development) on any host
  isCentralHost(host?: string): boolean {
    const baseDomain = (process.env.BASE_DOMAIN || '').toLowerCase();
    return !baseDomain || (host || '').split(':')[0].toLowerCase() === baseDomain;
  }

  // Hosts outside BASE_DOMAIN (e.g. localhost in development) fall back to DEFAULT_BAND.
  resolveSlug(host?: string): string | undefined {
    return this.slugFromHost(host) ?? (process.env.DEFAULT_BAND || undefined);
  }

  // Disabled bands are left out, so their hosts resolve to no band at all
  async findBySlug(slug: string): Promise<BandDto | null> {
    const band = await this.prisma.band.findFirst({ where: { slug, active: true }, select: BAND_FIELDS });
    return band ? toBandDto(band) : null;
  }

  async findById(id: number): Promise<BandDto | null> {
    const band = await this.prisma.band.findUnique({ where: { id }, select: BAND_FIELDS });
    return band ? toBandDto(band) : null;
  }

  async getLogo(id: number): Promise<{ data: Buffer; type: string } | null> {
    const band = await this.prisma.band.findUnique({
      where: { id },
      select: { logo: true, logoType: true },
    });
    return band?.logo && band.logoType ? { data: Buffer.from(band.logo), type: band.logoType } : null;
  }

  async setLogo(id: number, data: Buffer): Promise<BandDto> {
    if (data.length > MAX_LOGO_BYTES) {
      throw new BadRequestException('Logo must be at most 1 MB');
    }
    const type = LOGO_SIGNATURES.find((s) => s.matches(data))?.type;
    if (!type) {
      throw new BadRequestException('Logo must be a PNG, JPEG or WebP image');
    }

    const band = await this.prisma.band.update({
      where: { id },
      data: { logo: data, logoType: type, logoUpdatedAt: new Date() },
      select: BAND_FIELDS,
    });
    return toBandDto(band);
  }

  async updateCalendarSettings(id: number, settings: CalendarSettings): Promise<BandDto> {
    const data: { timeZone?: string; defaultEventMinutes?: number } = {};
    if (settings.timeZone !== undefined) {
      const timeZone = typeof settings.timeZone === 'string' ? settings.timeZone.trim() : '';
      if (!isValidTimeZone(timeZone)) {
        throw new BadRequestException('Unknown time zone');
      }
      data.timeZone = timeZone;
    }
    if (settings.defaultEventMinutes !== undefined) {
      const minutes = Number(settings.defaultEventMinutes);
      if (!Number.isInteger(minutes) || minutes < MIN_EVENT_MINUTES || minutes > MAX_EVENT_MINUTES) {
        throw new BadRequestException(
          `Default duration must be from ${MIN_EVENT_MINUTES} to ${MAX_EVENT_MINUTES} minutes`,
        );
      }
      data.defaultEventMinutes = minutes;
    }

    const band = await this.prisma.band.update({ where: { id }, data, select: BAND_FIELDS });
    return toBandDto(band);
  }

  async removeLogo(id: number): Promise<BandDto> {
    const band = await this.prisma.band.update({
      where: { id },
      data: { logo: null, logoType: null, logoUpdatedAt: null },
      select: BAND_FIELDS,
    });
    return toBandDto(band);
  }
}
