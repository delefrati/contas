import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { RequestContextService } from '../common/request-context.service';

export type SetlistItemType = 'song' | 'pause';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class SetlistItemInput {
  type!: SetlistItemType;
  songId?: number;
  label?: string;
}

export class SetlistItemDto {
  id!: number;
  type!: SetlistItemType;
  songId!: number | null;
  title!: string | null;
  artist!: string | null;
  notes!: string | null;
  label!: string | null;
  position!: number;
}

export class EventTypeSummaryDto {
  id!: number;
  name!: string;
  color!: string;
}

export class EventDto {
  id!: number;
  typeId!: number;
  type!: EventTypeSummaryDto;
  title!: string;
  date!: string;
  time!: string;
  location!: string | null;
  notes!: string | null;
  createdAt!: string;
  songCount!: number;
  setlist?: SetlistItemDto[];
}

export class CreateEventDto {
  typeId!: number;
  title?: string;
  date!: string;
  time?: string;
  location?: string;
  notes?: string;
  items?: SetlistItemInput[];
}

export class UpdateEventDto {
  typeId?: number;
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  notes?: string;
  items?: SetlistItemInput[];
}

export class ListEventsQuery {
  from?: string;
  to?: string;
}

type EventFields = {
  title?: string;
  date?: string;
  time?: string;
  location?: string | null;
  notes?: string | null;
};

@Injectable()
export class EventService {
  constructor(
    private prisma: PrismaService,
    private logService: LogService,
    private requestContext: RequestContextService,
  ) {}

  // Validates and normalizes the plain event fields present in the payload
  private parseFields(dto: UpdateEventDto): EventFields {
    const data: EventFields = {};

    if (dto.title !== undefined) {
      data.title = String(dto.title).trim().slice(0, 255);
    }

    if (dto.date !== undefined) {
      if (!DATE_PATTERN.test(dto.date)) {
        throw new BadRequestException('Invalid date format.');
      }
      data.date = dto.date;
    }

    if (dto.time !== undefined) {
      const time = String(dto.time).trim();
      if (time && !TIME_PATTERN.test(time)) {
        throw new BadRequestException('Invalid time format.');
      }
      data.time = time;
    }

    if (dto.location !== undefined) {
      data.location = String(dto.location).trim().slice(0, 255) || null;
    }

    if (dto.notes !== undefined) {
      data.notes = String(dto.notes).trim() || null;
    }

    return data;
  }

  // Only the band's current types can be picked
  private async parseTypeId(typeId: unknown): Promise<number> {
    const id = parseInt(String(typeId));
    const type = Number.isFinite(id)
      ? await this.prisma.eventType.findFirst({
          where: { id, bandId: this.requestContext.requireBandId(), deletedAt: null },
          select: { id: true },
        })
      : null;
    if (!type) {
      throw new BadRequestException('Invalid event type.');
    }
    return type.id;
  }

  private async normalizeItems(
    items: SetlistItemInput[],
  ): Promise<{ type: SetlistItemType; songId: number | null; label: string | null }[]> {
    const rawItems = Array.isArray(items) ? items : [];

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
        where: {
          id: { in: songIdCandidates },
          bandId: this.requestContext.requireBandId(),
          deletedAt: null,
        },
        select: { id: true },
      });
      validIds = new Set(existing.map((s) => s.id));
    }

    const ordered: { type: SetlistItemType; songId: number | null; label: string | null }[] = [];
    const seenSongs = new Set<number>();

    for (const item of rawItems) {
      if (item?.type === 'pause') {
        const label =
          typeof item.label === 'string' ? item.label.trim().slice(0, 255) : '';
        ordered.push({ type: 'pause', songId: null, label: label || null });
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
      ordered.push({ type: 'song', songId, label: null });
    }

    return ordered;
  }

  private mapToDto(event: {
    id: number;
    typeId: number;
    type: { id: number; name: string; color: string };
    title: string;
    date: string;
    time: string;
    location: string | null;
    notes: string | null;
    createdAt: Date;
  }): EventDto {
    return {
      id: event.id,
      typeId: event.typeId,
      type: { id: event.type.id, name: event.type.name, color: event.type.color },
      title: event.title,
      date: event.date,
      time: event.time,
      location: event.location,
      notes: event.notes,
      createdAt: event.createdAt.toISOString(),
      songCount: 0,
    };
  }

  async findAll(query: ListEventsQuery = {}): Promise<EventDto[]> {
    const date: { gte?: string; lte?: string } = {};
    if (query.from && DATE_PATTERN.test(query.from)) date.gte = query.from;
    if (query.to && DATE_PATTERN.test(query.to)) date.lte = query.to;

    const events = await this.prisma.event.findMany({
      where: {
        bandId: this.requestContext.requireBandId(),
        deletedAt: null,
        ...(Object.keys(date).length > 0 ? { date } : {}),
      },
      include: {
        type: true,
        _count: { select: { setlist: { where: { type: 'song' } } } },
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }, { id: 'asc' }],
    });

    return events.map((event) => ({
      ...this.mapToDto(event),
      songCount: event._count.setlist,
    }));
  }

  async findOne(id: number): Promise<EventDto> {
    const event = await this.prisma.event.findFirst({
      where: { id, bandId: this.requestContext.requireBandId() },
      include: {
        type: true,
        setlist: {
          include: { song: true },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!event || event.deletedAt) {
      throw new NotFoundException('Event not found.');
    }

    return {
      ...this.mapToDto(event),
      songCount: event.setlist.filter((entry) => entry.type === 'song').length,
      setlist: event.setlist.map((entry) => ({
        id: entry.id,
        type: entry.type === 'pause' ? 'pause' : 'song',
        songId: entry.songId,
        title: entry.song?.title ?? null,
        artist: entry.song?.artist ?? null,
        notes: entry.song?.notes ?? null,
        label: entry.label ?? null,
        position: entry.position,
      })),
    };
  }

  async create(dto: CreateEventDto): Promise<EventDto> {
    if (!dto?.date) {
      throw new BadRequestException('Event date is required.');
    }

    const fields = this.parseFields(dto);
    const typeId = await this.parseTypeId(dto.typeId);
    const event = await this.prisma.event.create({
      data: {
        bandId: this.requestContext.requireBandId(),
        typeId,
        title: fields.title ?? '',
        date: fields.date!,
        time: fields.time ?? '',
        location: fields.location ?? null,
        notes: fields.notes ?? null,
      },
    });

    if (dto.items !== undefined) {
      await this.setItems(event.id, dto.items);
    }

    await this.logService.log('CREATE', 'event', event.id, {
      typeId: event.typeId,
      title: event.title,
      date: event.date,
    });

    return this.findOne(event.id);
  }

  async update(id: number, dto: UpdateEventDto): Promise<EventDto> {
    const existing = await this.prisma.event.findFirst({
      where: { id, bandId: this.requestContext.requireBandId() },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Event not found.');
    }

    const data: EventFields & { typeId?: number } = this.parseFields(dto);
    // Keeping the current type is fine even if it was deleted meanwhile
    if (dto.typeId !== undefined && Number(dto.typeId) !== existing.typeId) {
      data.typeId = await this.parseTypeId(dto.typeId);
    }
    if (Object.keys(data).length > 0) {
      await this.prisma.event.update({ where: { id }, data });
    }

    if (dto.items !== undefined) {
      await this.setItems(id, dto.items);
    }

    await this.logService.log('UPDATE', 'event', id, dto);

    return this.findOne(id);
  }

  private async setItems(eventId: number, items: SetlistItemInput[]): Promise<void> {
    const normalized = await this.normalizeItems(items);

    await this.prisma.eventSong.deleteMany({ where: { eventId } });

    if (normalized.length > 0) {
      await this.prisma.eventSong.createMany({
        data: normalized.map((item, index) => ({
          eventId,
          songId: item.songId,
          type: item.type,
          label: item.label,
          position: index,
        })),
      });
    }
  }

  async delete(id: number): Promise<void> {
    const event = await this.prisma.event.findFirst({
      where: { id, bandId: this.requestContext.requireBandId() },
    });
    if (!event || event.deletedAt) {
      return;
    }

    await this.prisma.event.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.logService.log('DELETE', 'event', id, {
      typeId: event.typeId,
      title: event.title,
      date: event.date,
    });
  }
}
