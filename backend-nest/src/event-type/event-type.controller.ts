import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateEventTypeDto,
  EventTypeDto,
  EventTypeService,
  UpdateEventTypeDto,
} from './event-type.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/event-types')
@UseGuards(JwtAuthGuard)
export class EventTypeController {
  constructor(private eventTypeService: EventTypeService) {}

  @Get()
  async list(@Query('includeDeleted') includeDeleted?: string): Promise<{ data: EventTypeDto[] }> {
    const data = await this.eventTypeService.findAll(includeDeleted === 'true');
    return { data };
  }

  @Post()
  async create(@Body() createEventTypeDto: CreateEventTypeDto): Promise<{ data: EventTypeDto }> {
    const data = await this.eventTypeService.create(createEventTypeDto);
    return { data };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEventTypeDto: UpdateEventTypeDto,
  ): Promise<{ data: EventTypeDto }> {
    const data = await this.eventTypeService.update(id, updateEventTypeDto);
    return { data };
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.eventTypeService.softDelete(id);
  }
}
