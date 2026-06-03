import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ExpenseService, ExpenseDto, CreateExpenseDto, UpdateExpenseDto, ReportByMemberDto } from './expense.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/expenses')
@UseGuards(JwtAuthGuard)
export class ExpenseController {
  constructor(private expenseService: ExpenseService) {}

  @Post()
  async create(@Body() createExpenseDto: CreateExpenseDto): Promise<{ data: ExpenseDto }> {
    const data = await this.expenseService.create(createExpenseDto);
    return { data };
  }

  @Get()
  async list(): Promise<{ data: ExpenseDto[] }> {
    const data = await this.expenseService.findAll();
    return { data };
  }

  @Get('report/by-member')
  async reportByMember(): Promise<{ data: ReportByMemberDto[] }> {
    const data = await this.expenseService.reportByMember();
    return { data };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateExpenseDto: UpdateExpenseDto,
  ): Promise<{ data: ExpenseDto }> {
    const data = await this.expenseService.update(id, updateExpenseDto);
    return { data };
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.expenseService.delete(id);
  }
}
