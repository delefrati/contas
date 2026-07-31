import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';

export class SongDto {
  id!: number;
  title!: string;
  artist!: string | null;
  notes!: string | null;
  createdAt!: string;
}

export class CreateSongDto {
  title!: string;
  artist?: string;
  notes?: string;
}

export class UpdateSongDto {
  title?: string;
  artist?: string;
  notes?: string;
}

export class ImportSongItemDto {
  title!: string;
  artist?: string;
}

export class ImportSongsDto {
  songs?: ImportSongItemDto[];
  text?: string;
}

export class ImportSongsResultDto {
  created!: number;
  skipped!: number;
  songs!: SongDto[];
}

@Injectable()
export class SongService {
  constructor(
    private prisma: PrismaService,
    private logService: LogService,
  ) {}

  private mapToDto(song: {
    id: number;
    title: string;
    artist: string | null;
    notes: string | null;
    createdAt: Date;
  }): SongDto {
    return {
      id: song.id,
      title: song.title,
      artist: song.artist,
      notes: song.notes,
      createdAt: song.createdAt.toISOString(),
    };
  }

  async findAll(): Promise<SongDto[]> {
    const songs = await this.prisma.song.findMany({
      where: { deletedAt: null },
      orderBy: { title: 'asc' },
    });

    return songs.map((song) => this.mapToDto(song));
  }

  async create(dto: CreateSongDto): Promise<SongDto> {
    const title = dto?.title?.trim() || '';
    if (!title) {
      throw new BadRequestException('Song title is required.');
    }

    const song = await this.prisma.song.create({
      data: {
        title,
        artist: dto.artist?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
    });

    await this.logService.log('CREATE', 'song', song.id, { title });

    return this.mapToDto(song);
  }

  private parseTextToItems(text: string): ImportSongItemDto[] {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      // Ignore section markers like "(Bis)" that are not actual songs
      .filter((line) => !/^\(.*\)$/.test(line))
      .map((line) => {
        // Support "Title - Artist" (also en/em dashes)
        const match = line.match(/^(.*?)\s+[-\u2013\u2014]\s+(.+)$/);
        if (match) {
          return { title: match[1].trim(), artist: match[2].trim() };
        }
        return { title: line };
      });
  }

  async importMany(dto: ImportSongsDto): Promise<ImportSongsResultDto> {
    let items: ImportSongItemDto[] = [];

    if (Array.isArray(dto?.songs) && dto.songs.length > 0) {
      items = dto.songs;
    } else if (typeof dto?.text === 'string') {
      items = this.parseTextToItems(dto.text);
    }

    // Normalize and drop entries without a title
    const normalized = items
      .map((item) => ({
        title: (item?.title || '').trim(),
        artist: (item?.artist || '').trim() || null,
      }))
      .filter((item) => item.title.length > 0);

    if (normalized.length === 0) {
      throw new BadRequestException('No songs to import.');
    }

    const existing = await this.prisma.song.findMany({
      where: { deletedAt: null },
      select: { title: true },
    });
    const existingTitles = new Set(existing.map((s) => s.title.toLowerCase()));

    const created: SongDto[] = [];
    let skipped = 0;
    const seenInBatch = new Set<string>();

    for (const item of normalized) {
      const key = item.title.toLowerCase();
      if (existingTitles.has(key) || seenInBatch.has(key)) {
        skipped++;
        continue;
      }
      seenInBatch.add(key);

      const song = await this.prisma.song.create({
        data: { title: item.title, artist: item.artist },
      });
      created.push(this.mapToDto(song));
    }

    if (created.length > 0) {
      await this.logService.log('IMPORT', 'song', undefined, {
        created: created.length,
        skipped,
      });
    }

    return { created: created.length, skipped, songs: created };
  }

  async update(id: number, dto: UpdateSongDto): Promise<SongDto> {
    const existing = await this.prisma.song.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Song not found.');
    }

    const data: { title?: string; artist?: string | null; notes?: string | null } = {};

    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (!title) throw new BadRequestException('Song title is required.');
      data.title = title;
    }

    if (dto.artist !== undefined) {
      data.artist = dto.artist.trim() || null;
    }

    if (dto.notes !== undefined) {
      data.notes = dto.notes.trim() || null;
    }

    const song = await this.prisma.song.update({ where: { id }, data });

    await this.logService.log('UPDATE', 'song', id, dto);

    return this.mapToDto(song);
  }

  async delete(id: number): Promise<void> {
    const song = await this.prisma.song.findUnique({ where: { id } });
    if (!song || song.deletedAt) {
      return;
    }

    await this.prisma.song.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.logService.log('DELETE', 'song', id, { title: song.title });
  }
}
