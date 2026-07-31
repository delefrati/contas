import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateSongDto, SongDto, SongService, UpdateSongDto, ImportSongsDto, ImportSongsResultDto } from './song.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/songs')
@UseGuards(JwtAuthGuard)
export class SongController {
  constructor(private songService: SongService) {}

  @Get()
  async list(): Promise<{ data: SongDto[] }> {
    const data = await this.songService.findAll();
    return { data };
  }

  @Post()
  async create(@Body() createSongDto: CreateSongDto): Promise<{ data: SongDto }> {
    const data = await this.songService.create(createSongDto);
    return { data };
  }

  @Post('import')
  async import(@Body() importSongsDto: ImportSongsDto): Promise<{ data: ImportSongsResultDto }> {
    const data = await this.songService.importMany(importSongsDto);
    return { data };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSongDto: UpdateSongDto,
  ): Promise<{ data: SongDto }> {
    const data = await this.songService.update(id, updateSongDto);
    return { data };
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.songService.delete(id);
  }
}
