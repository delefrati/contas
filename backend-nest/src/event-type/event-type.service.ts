import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { RequestContextService } from '../common/request-context.service';

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const DEFAULT_COLOR = '#667eea';

export class EventTypeDto {
  id!: number;
  name!: string;
  color!: string;
  deletedAt!: string | null;
}

export class CreateEventTypeDto {
  name!: string;
  color?: string;
}

export class UpdateEventTypeDto {
  name?: string;
  color?: string;
}

@Injectable()
export class EventTypeService {
  constructor(
    private prisma: PrismaService,
    private logService: LogService,
    private requestContext: RequestContextService,
  ) {}

  private mapToDto(type: {
    id: number;
    name: string;
    color: string;
    deletedAt: Date | null;
  }): EventTypeDto {
    return {
      id: type.id,
      name: type.name,
      color: type.color,
      deletedAt: type.deletedAt ? type.deletedAt.toISOString() : null,
    };
  }

  private parseName(name?: string): string {
    const trimmed = String(name ?? '').trim().slice(0, 255);
    if (!trimmed) {
      throw new BadRequestException('Event type name is required.');
    }
    return trimmed;
  }

  private parseColor(color?: string): string | undefined {
    if (color === undefined) return undefined;
    if (!COLOR_PATTERN.test(color)) {
      throw new BadRequestException('Invalid color.');
    }
    return color.toLowerCase();
  }

  private async assertNameAvailable(bandId: number, name: string, exceptId?: number): Promise<void> {
    const activeType = await this.prisma.eventType.findFirst({
      where: {
        bandId,
        name,
        deletedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });

    if (activeType) {
      throw new ConflictException('Event type already exists.');
    }
  }

  async findAll(includeDeleted = false): Promise<EventTypeDto[]> {
    const types = await this.prisma.eventType.findMany({
      where: {
        bandId: this.requestContext.requireBandId(),
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      orderBy: { name: 'asc' },
    });

    return types.map((type) => this.mapToDto(type));
  }

  async create(dto: CreateEventTypeDto): Promise<EventTypeDto> {
    const name = this.parseName(dto?.name);
    const color = this.parseColor(dto?.color) ?? DEFAULT_COLOR;
    const bandId = this.requestContext.requireBandId();

    await this.assertNameAvailable(bandId, name);

    // Recreating a deleted type brings it back, keeping its past events attached
    const deletedType = await this.prisma.eventType.findFirst({
      where: { bandId, name, deletedAt: { not: null } },
    });

    const type = deletedType
      ? await this.prisma.eventType.update({
          where: { id: deletedType.id },
          data: { deletedAt: null, color },
        })
      : await this.prisma.eventType.create({
          data: { bandId, name, color },
        });

    await this.logService.log(deletedType ? 'RESTORE' : 'CREATE', 'eventType', type.id, { name });

    return this.mapToDto(type);
  }

  async update(id: number, dto: UpdateEventTypeDto): Promise<EventTypeDto> {
    const bandId = this.requestContext.requireBandId();
    const existing = await this.prisma.eventType.findFirst({ where: { id, bandId } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Event type not found.');
    }

    const data: { name?: string; color?: string } = {};
    if (dto.name !== undefined) {
      data.name = this.parseName(dto.name);
      await this.assertNameAvailable(bandId, data.name, id);
    }
    const color = this.parseColor(dto.color);
    if (color) data.color = color;

    const type = await this.prisma.eventType.update({ where: { id }, data });

    await this.logService.log('UPDATE', 'eventType', id, dto);

    return this.mapToDto(type);
  }

  async softDelete(id: number): Promise<void> {
    const type = await this.prisma.eventType.findFirst({
      where: { id, bandId: this.requestContext.requireBandId() },
      select: { id: true, deletedAt: true, name: true },
    });

    if (!type) {
      throw new NotFoundException('Event type not found.');
    }

    if (type.deletedAt) {
      return;
    }

    // Past events keep their type; it just can't be picked for new ones
    await this.prisma.eventType.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.logService.log('DELETE', 'eventType', id, { name: type.name });
  }
}
