import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export class BandDto {
  id!: number;
  slug!: string;
  name!: string;
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

  // Hosts outside BASE_DOMAIN (e.g. localhost in development) fall back to DEFAULT_BAND.
  resolveSlug(host?: string): string | undefined {
    return this.slugFromHost(host) ?? (process.env.DEFAULT_BAND || undefined);
  }

  async findBySlug(slug: string): Promise<BandDto | null> {
    const band = await this.prisma.band.findUnique({ where: { slug } });
    return band ? { id: band.id, slug: band.slug, name: band.name } : null;
  }

  async findById(id: number): Promise<BandDto | null> {
    const band = await this.prisma.band.findUnique({ where: { id } });
    return band ? { id: band.id, slug: band.slug, name: band.name } : null;
  }
}
