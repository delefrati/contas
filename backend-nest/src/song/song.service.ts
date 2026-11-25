import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { RequestContextService } from '../common/request-context.service';
import { parseSpotifyLink, spotifyTrackUrl } from './spotify-link';
import { Type } from 'class-transformer';
import { IsArray, IsByteLength, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { TEXT_COLUMN_BYTES } from '../common/request-validation';

export class SongDto {
  id!: number;
  title!: string;
  artist!: string | null;
  notes!: string | null;
  hasLyrics!: boolean;
  spotifyTrackId!: string | null;
  spotifyUrl!: string | null;
  createdAt!: string;
}

// Lyrics only come with a single song: the list stays light for big repertoires
export class SongWithLyricsDto extends SongDto {
  lyrics!: string | null;
}

export class CreateSongDto {
  @IsString() @MaxLength(255) title!: string;
  @IsOptional() @IsString() @MaxLength(255) artist?: string;
  @IsOptional() @IsString() @IsByteLength(0, TEXT_COLUMN_BYTES) notes?: string;
  @IsOptional() @IsString() @IsByteLength(0, TEXT_COLUMN_BYTES) lyrics?: string;
  // A track link or URI; empty removes it
  @IsOptional() @IsString() @MaxLength(255) spotifyUrl?: string;
}

export class UpdateSongDto {
  @IsOptional() @IsString() @MaxLength(255) title?: string;
  @IsOptional() @IsString() @MaxLength(255) artist?: string;
  @IsOptional() @IsString() @IsByteLength(0, TEXT_COLUMN_BYTES) notes?: string;
  @IsOptional() @IsString() @IsByteLength(0, TEXT_COLUMN_BYTES) lyrics?: string;
  // A track link or URI; empty removes it
  @IsOptional() @IsString() @MaxLength(255) spotifyUrl?: string;
}

export class ImportSongItemDto {
  // Items without a title are skipped
  @IsOptional() @IsString() @MaxLength(255) title?: string;
  @IsOptional() @IsString() @MaxLength(255) artist?: string;
}

export class ImportSongsDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ImportSongItemDto)
  songs?: ImportSongItemDto[];
  // One song a line, as "Title - Artist"; importMany checks each line's lengths
  @IsOptional() @IsString() text?: string;
}

export class ImportSongsResultDto {
  created!: number;
  skipped!: number;
  songs!: SongDto[];
}

type SongRow = {
  id: number;
  title: string;
  artist: string | null;
  notes: string | null;
  lyrics: string | null;
  spotifyTrackId: string | null;
  createdAt: Date;
};

@Injectable()
export class SongService {
  constructor(
    private prisma: PrismaService,
    private logService: LogService,
    private requestContext: RequestContextService,
  ) {}

  private mapToDto(song: SongRow): SongDto {
    return {
      id: song.id,
      title: song.title,
      artist: song.artist,
      notes: song.notes,
      hasLyrics: !!song.lyrics,
      spotifyTrackId: song.spotifyTrackId,
      spotifyUrl: spotifyTrackUrl(song.spotifyTrackId),
      createdAt: song.createdAt.toISOString(),
    };
  }

  private mapToDtoWithLyrics(song: SongRow): SongWithLyricsDto {
    return { ...this.mapToDto(song), lyrics: song.lyrics };
  }

  // Trailing spaces go, but blank lines between verses stay
  private normalizeLyrics(lyrics: string): string | null {
    const text = String(lyrics).replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '');
    return text.trim() ? text.replace(/^\n+|\n+$/g, '') : null;
  }

  // Lyrics are long: the log only tells they changed
  private logDetails<T extends { lyrics?: string }>(dto: T) {
    const { lyrics, ...rest } = dto;
    return lyrics === undefined ? rest : { ...rest, lyricsChanged: true };
  }

  async findAll(): Promise<SongDto[]> {
    const songs = await this.prisma.song.findMany({
      where: { bandId: this.requestContext.requireBandId(), deletedAt: null },
      orderBy: { title: 'asc' },
    });

    return songs.map((song) => this.mapToDto(song));
  }

  // For the offline download only: a phone needs every lyric without opening each song
  async findAllWithLyrics(): Promise<SongWithLyricsDto[]> {
    const songs = await this.prisma.song.findMany({
      where: { bandId: this.requestContext.requireBandId(), deletedAt: null },
      orderBy: { title: 'asc' },
    });

    return songs.map((song) => this.mapToDtoWithLyrics(song));
  }

  async findOne(id: number): Promise<SongWithLyricsDto> {
    const song = await this.prisma.song.findFirst({
      where: { id, bandId: this.requestContext.requireBandId(), deletedAt: null },
    });
    if (!song) {
      throw new NotFoundException('Song not found.');
    }

    return this.mapToDtoWithLyrics(song);
  }

  async create(dto: CreateSongDto): Promise<SongWithLyricsDto> {
    const title = dto?.title?.trim() || '';
    if (!title) {
      throw new BadRequestException('Song title is required.');
    }

    const song = await this.prisma.song.create({
      data: {
        bandId: this.requestContext.requireBandId(),
        title,
        artist: dto.artist?.trim() || null,
        notes: dto.notes?.trim() || null,
        lyrics: dto.lyrics !== undefined ? this.normalizeLyrics(dto.lyrics) : null,
        spotifyTrackId: parseSpotifyLink(dto.spotifyUrl),
      },
    });

    await this.logService.log('CREATE', 'song', song.id, { title });

    return this.mapToDtoWithLyrics(song);
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
    // Lines of the text aren't checked by the DTO, and the columns take 255 characters
    if (normalized.some((item) => item.title.length > 255 || (item.artist?.length ?? 0) > 255)) {
      throw new BadRequestException('A title or artist is longer than 255 characters.');
    }

    const bandId = this.requestContext.requireBandId();
    const existing = await this.prisma.song.findMany({
      where: { bandId, deletedAt: null },
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
        data: { bandId, title: item.title, artist: item.artist },
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

  async update(id: number, dto: UpdateSongDto): Promise<SongWithLyricsDto> {
    const existing = await this.prisma.song.findFirst({
      where: { id, bandId: this.requestContext.requireBandId() },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Song not found.');
    }

    const data: {
      title?: string;
      artist?: string | null;
      notes?: string | null;
      lyrics?: string | null;
      spotifyTrackId?: string | null;
    } = {};

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

    if (dto.lyrics !== undefined) {
      data.lyrics = this.normalizeLyrics(dto.lyrics);
    }

    if (dto.spotifyUrl !== undefined) {
      data.spotifyTrackId = parseSpotifyLink(dto.spotifyUrl);
    }

    const song = await this.prisma.song.update({ where: { id }, data });

    await this.logService.log('UPDATE', 'song', id, this.logDetails(dto));

    return this.mapToDtoWithLyrics(song);
  }

  async delete(id: number): Promise<void> {
    const song = await this.prisma.song.findFirst({
      where: { id, bandId: this.requestContext.requireBandId() },
    });
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
