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
  CreateEventDto,
  EventDto,
  EventService,
  ListEventsQuery,
  UpdateEventDto,
} from './event.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/events')
@UseGuards(JwtAuthGuard)
export class EventController {
  constructor(private eventService: EventService) {}

  @Get()
  async list(@Query() query: ListEventsQuery): Promise<{ data: EventDto[] }> {
    const data = await this.eventService.findAll(query);
    return { data };
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number): Promise<{ data: EventDto }> {
    const data = await this.eventService.findOne(id);
    return { data };
  }

  @Post()
  async create(@Body() createEventDto: CreateEventDto): Promise<{ data: EventDto }> {
    const data = await this.eventService.create(createEventDto);
    return { data };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEventDto: UpdateEventDto,
  ): Promise<{ data: EventDto }> {
    const data = await this.eventService.update(id, updateEventDto);
    return { data };
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.eventService.delete(id);
  }
}
