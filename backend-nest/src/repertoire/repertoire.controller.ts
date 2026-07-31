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
import {
  CreateRepertoireDto,
  RepertoireDto,
  RepertoireService,
  UpdateRepertoireDto,
} from './repertoire.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/repertoires')
@UseGuards(JwtAuthGuard)
export class RepertoireController {
  constructor(private repertoireService: RepertoireService) {}

  @Get()
  async list(): Promise<{ data: RepertoireDto[] }> {
    const data = await this.repertoireService.findAll();
    return { data };
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number): Promise<{ data: RepertoireDto }> {
    const data = await this.repertoireService.findOne(id);
    return { data };
  }

  @Post()
  async create(@Body() createRepertoireDto: CreateRepertoireDto): Promise<{ data: RepertoireDto }> {
    const data = await this.repertoireService.create(createRepertoireDto);
    return { data };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRepertoireDto: UpdateRepertoireDto,
  ): Promise<{ data: RepertoireDto }> {
    const data = await this.repertoireService.update(id, updateRepertoireDto);
    return { data };
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.repertoireService.delete(id);
  }
}
