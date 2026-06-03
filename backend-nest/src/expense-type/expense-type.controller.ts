import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateExpenseTypeDto,
  ExpenseTypeDto,
  ExpenseTypeService,
} from './expense-type.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/expense-types')
@UseGuards(JwtAuthGuard)
export class ExpenseTypeController {
  constructor(private expenseTypeService: ExpenseTypeService) {}

  @Get()
  async list(@Query('includeDeleted') includeDeleted?: string): Promise<{ data: ExpenseTypeDto[] }> {
    const data = await this.expenseTypeService.findAll(includeDeleted === 'true');
    return { data };
  }

  @Post()
  async create(@Body() createExpenseTypeDto: CreateExpenseTypeDto): Promise<{ data: ExpenseTypeDto }> {
    const data = await this.expenseTypeService.create(createExpenseTypeDto);
    return { data };
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.expenseTypeService.softDelete(id);
  }
}
