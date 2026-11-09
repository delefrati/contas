import { Injectable, NotFoundException } from '@nestjs/common';
import { BandDto, BandService } from '../band/band.service';
import { RequestContextService } from '../common/request-context.service';
import { EventDto, EventService } from '../event/event.service';
import { EventTypeDto, EventTypeService } from '../event-type/event-type.service';
import { SongService, SongWithLyricsDto } from '../song/song.service';

export class OfflineSnapshotDto {
  generatedAt!: string;
  // Dates covered by `events`, so the app can tell "no events" from "not downloaded"
  window!: { from: string; to: string };
  band!: BandDto;
  eventTypes!: EventTypeDto[];
  events!: EventDto[];
  songs!: SongWithLyricsDto[];
}

const MONTHS_AHEAD = 12;

function toDateString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

@Injectable()
export class OfflineService {
  constructor(
    private bandService: BandService,
    private eventService: EventService,
    private eventTypeService: EventTypeService,
    private songService: SongService,
    private requestContext: RequestContextService,
  ) {}

  async getSnapshot(now = new Date()): Promise<OfflineSnapshotDto> {
    const band = await this.bandService.findById(this.requestContext.requireBandId());
    if (!band) throw new NotFoundException('Band not found');

    const from = toDateString(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const to = toDateString(new Date(now.getFullYear(), now.getMonth() + MONTHS_AHEAD, now.getDate()));

    const [eventTypes, events, songs] = await Promise.all([
      this.eventTypeService.findAll(),
      this.eventService.findAllWithSetlists(from, to),
      this.songService.findAllWithLyrics(),
    ]);

    return {
      generatedAt: now.toISOString(),
      window: { from, to },
      band,
      eventTypes,
      events,
      songs,
    };
  }
}
