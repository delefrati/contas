import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';

export type RepertoireItemType = 'song' | 'pause';

export class RepertoireItemInput {
  type!: RepertoireItemType;
  songId?: number;
}

export class RepertoireSongDto {
  id!: number;
  type!: RepertoireItemType;
  songId!: number | null;
  title!: string | null;
  artist!: string | null;
  notes!: string | null;
  position!: number;
}

export class RepertoireDto {
  id!: number;
  name!: string;
  date!: string;
  createdAt!: string;
  songCount!: number;
  songs?: RepertoireSongDto[];
}

export class CreateRepertoireDto {
  name!: string;
  date?: string;
  songIds?: number[];
  items?: RepertoireItemInput[];
}

export class UpdateRepertoireDto {
  name?: string;
  date?: string;
  songIds?: number[];
  items?: RepertoireItemInput[];
}

@Injectable()
export class RepertoireService {
  constructor(
    private prisma: PrismaService,
    private logService: LogService,
  ) {}

  private normalizeDate(date?: string): string {
    return date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date().toISOString().slice(0, 10);
  }

  private async normalizeItems(
    songIds?: number[],
    items?: RepertoireItemInput[],
  ): Promise<{ type: RepertoireItemType; songId: number | null }[]> {
    // Prefer the richer `items` payload; fall back to legacy `songIds`.
    const rawItems: RepertoireItemInput[] = Array.isArray(items)
      ? items
      : (songIds || []).map((songId) => ({ type: 'song' as const, songId }));

    const songIdCandidates: number[] = [];
    for (const item of rawItems) {
      if (item?.type === 'song') {
        const songId = parseInt(String(item.songId));
        if (Number.isFinite(songId) && songId > 0) {
          songIdCandidates.push(songId);
        }
      }
    }

    let validIds = new Set<number>();
    if (songIdCandidates.length > 0) {
      const existing = await this.prisma.song.findMany({
        where: { id: { in: songIdCandidates }, deletedAt: null },
        select: { id: true },
      });
      validIds = new Set(existing.map((s) => s.id));
    }

    const ordered: { type: RepertoireItemType; songId: number | null }[] = [];
    const seenSongs = new Set<number>();

    for (const item of rawItems) {
      if (item?.type === 'pause') {
        ordered.push({ type: 'pause', songId: null });
        continue;
      }

      const songId = parseInt(String(item?.songId));
      if (!Number.isFinite(songId) || songId <= 0 || seenSongs.has(songId)) {
        continue;
      }
      if (!validIds.has(songId)) {
        continue;
      }
      seenSongs.add(songId);
      ordered.push({ type: 'song', songId });
    }

    return ordered;
  }

  async findAll(): Promise<RepertoireDto[]> {
    const repertoires = await this.prisma.repertoire.findMany({
      where: { deletedAt: null },
      include: {
        _count: { select: { songs: { where: { type: 'song' } } } },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });

    return repertoires.map((repertoire) => ({
      id: repertoire.id,
      name: repertoire.name,
      date: repertoire.date,
      createdAt: repertoire.createdAt.toISOString(),
      songCount: repertoire._count.songs,
    }));
  }

  async findOne(id: number): Promise<RepertoireDto> {
    const repertoire = await this.prisma.repertoire.findUnique({
      where: { id },
      include: {
        songs: {
          include: { song: true },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!repertoire || repertoire.deletedAt) {
      throw new NotFoundException('Repertoire not found.');
    }

    return {
      id: repertoire.id,
      name: repertoire.name,
      date: repertoire.date,
      createdAt: repertoire.createdAt.toISOString(),
      songCount: repertoire.songs.filter((entry) => entry.type === 'song').length,
      songs: repertoire.songs.map((entry) => ({
        id: entry.id,
        type: entry.type === 'pause' ? 'pause' : 'song',
        songId: entry.songId,
        title: entry.song?.title ?? null,
        artist: entry.song?.artist ?? null,
        notes: entry.song?.notes ?? null,
        position: entry.position,
      })),
    };
  }

  async create(dto: CreateRepertoireDto): Promise<RepertoireDto> {
    const name = dto?.name?.trim() || '';
    if (!name) {
      throw new BadRequestException('Repertoire name is required.');
    }

    const repertoire = await this.prisma.repertoire.create({
      data: {
        name,
        date: this.normalizeDate(dto.date),
      },
    });

    if (dto.songIds !== undefined || dto.items !== undefined) {
      await this.setItems(repertoire.id, dto.songIds, dto.items);
    }

    await this.logService.log('CREATE', 'repertoire', repertoire.id, { name });

    return this.findOne(repertoire.id);
  }

  async update(id: number, dto: UpdateRepertoireDto): Promise<RepertoireDto> {
    const existing = await this.prisma.repertoire.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Repertoire not found.');
    }

    const data: { name?: string; date?: string } = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Repertoire name is required.');
      data.name = name;
    }

    if (dto.date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.date)) {
        throw new BadRequestException('Invalid date format.');
      }
      data.date = dto.date;
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.repertoire.update({ where: { id }, data });
    }

    if (dto.songIds !== undefined || dto.items !== undefined) {
      await this.setItems(id, dto.songIds, dto.items);
    }

    await this.logService.log('UPDATE', 'repertoire', id, dto);

    return this.findOne(id);
  }

  private async setItems(
    repertoireId: number,
    songIds?: number[],
    items?: RepertoireItemInput[],
  ): Promise<void> {
    const normalized = await this.normalizeItems(songIds, items);

    await this.prisma.repertoireSong.deleteMany({ where: { repertoireId } });

    if (normalized.length > 0) {
      await this.prisma.repertoireSong.createMany({
        data: normalized.map((item, index) => ({
          repertoireId,
          songId: item.songId,
          type: item.type,
          position: index,
        })),
      });
    }
  }

  async delete(id: number): Promise<void> {
    const repertoire = await this.prisma.repertoire.findUnique({ where: { id } });
    if (!repertoire || repertoire.deletedAt) {
      return;
    }

    await this.prisma.repertoire.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.logService.log('DELETE', 'repertoire', id, { name: repertoire.name });
  }
}
