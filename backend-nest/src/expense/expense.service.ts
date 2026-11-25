import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { RequestContextService } from '../common/request-context.service';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsByteLength,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { TEXT_COLUMN_BYTES } from '../common/request-validation';

// What the amount column, DECIMAL(12, 2), holds
export const MAX_AMOUNT = 9_999_999_999.99;

export class ExpenseDto {
  id!: number;
  description!: string;
  typeId!: number;
  typeName?: string;
  amount!: number;
  date!: string;
  paid!: boolean;
  notes!: string | null;
  createdAt!: string;
  memberId!: number | null;
  memberIds!: number[];
  members!: string[];
}

// Refunds are negative amounts; the service checks the date's format and that the type and
// members are the band's
export class CreateExpenseDto {
  @IsString() @MaxLength(255) description!: string;
  @IsOptional() @IsInt() typeId?: number;
  @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(-MAX_AMOUNT) @Max(MAX_AMOUNT) amount!: number;
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsBoolean() paid?: boolean;
  @IsOptional() @IsString() @IsByteLength(0, TEXT_COLUMN_BYTES) notes?: string | null;
  @IsOptional() @IsArray() @IsInt({ each: true }) memberIds?: number[];
}

export class UpdateExpenseDto {
  @IsOptional() @IsString() @MaxLength(255) description?: string;
  @IsOptional() @IsInt() typeId?: number;
  // Left out to keep it; null is what the form sends for an amount that didn't parse
  @ValidateIf((_, value) => value !== undefined)
  @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(-MAX_AMOUNT) @Max(MAX_AMOUNT)
  amount?: number;
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsBoolean() paid?: boolean;
  @IsOptional() @IsString() @IsByteLength(0, TEXT_COLUMN_BYTES) notes?: string | null;
  @IsOptional() @IsArray() @IsInt({ each: true }) memberIds?: number[];
}

export class MarkPaidDto {
  @IsArray() @ArrayMinSize(1) @IsInt({ each: true }) ids!: number[];
  @IsBoolean() paid!: boolean;
}

export class ReportByMemberDto {
  id!: number;
  name!: string;
  active!: boolean;
  total!: number;
}

@Injectable()
export class ExpenseService {
  constructor(
    private prisma: PrismaService,
    private logService: LogService,
    private requestContext: RequestContextService,
  ) {}

  // Members referenced by an expense must belong to the current band.
  private async assertBandMembers(memberIds: number[], bandId: number): Promise<void> {
    if (memberIds.length === 0) return;
    const count = await this.prisma.member.count({
      where: { id: { in: memberIds }, bandId },
    });
    if (count !== memberIds.length) {
      throw new BadRequestException('Invalid member in the list sent.');
    }
  }

  async create(createExpenseDto: CreateExpenseDto): Promise<ExpenseDto> {
    const { description, typeId, amount, date, paid = false, notes, memberIds = [] } = createExpenseDto;
    const numericAmount = Number(amount);
    const normalizedAmount = Math.round(numericAmount * 100) / 100;
    const bandId = this.requestContext.requireBandId();

    // Validation
    const trimmedDescription = description?.trim() || '';
    if (!trimmedDescription) {
      throw new BadRequestException('Description is required.');
    }

    if (!Number.isFinite(numericAmount)) {
      throw new BadRequestException('Invalid amount.');
    }

    if (normalizedAmount === 0) {
      throw new BadRequestException('Amount cannot be zero.');
    }

    let normalizedTypeId: number;

    if (typeId === undefined || typeId === null) {
      const firstActiveType = await this.prisma.expenseType.findFirst({
        where: { bandId, deletedAt: null },
        orderBy: { id: 'asc' },
        select: { id: true },
      });

      if (!firstActiveType) {
        throw new BadRequestException('No active expense type available.');
      }

      normalizedTypeId = firstActiveType.id;
    } else {
      normalizedTypeId = parseInt(String(typeId));
      if (normalizedTypeId <= 0) {
        throw new BadRequestException('Invalid expense type.');
      }
    }

    const expenseType = await this.prisma.expenseType.findFirst({
      where: { id: normalizedTypeId, bandId },
      select: { id: true, deletedAt: true },
    });

    if (!expenseType || expenseType.deletedAt) {
      throw new BadRequestException('Invalid expense type.');
    }

    // Normalize memberIds
    let normalizedMemberIds = Array.from(
      new Set(memberIds.map((id) => parseInt(String(id))))
    );

    // Validate member IDs
    for (const memberId of normalizedMemberIds) {
      if (memberId <= 0) {
        throw new BadRequestException('Invalid member in the list sent.');
      }
    }
    await this.assertBandMembers(normalizedMemberIds, bandId);

    // If no members specified, apply to all active members
    if (normalizedMemberIds.length === 0) {
      const activeMembers = await this.prisma.member.findMany({
        where: { bandId, active: true },
        select: { id: true },
      });
      normalizedMemberIds = activeMembers.map((m) => m.id);
    }

    // Normalize date: use provided date or today
    const normalizedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date().toISOString().slice(0, 10);

    // Create expense with members
    const expense = await this.prisma.expense.create({
      data: {
        bandId,
        description: trimmedDescription,
        fkType: normalizedTypeId,
        amount: normalizedAmount,
        fkMember: normalizedMemberIds[0] || null,
        date: normalizedDate,
        paid: Boolean(paid),
        notes: this.normalizeNotes(notes),
        createdAt: new Date().toISOString(),
        members: {
          create: normalizedMemberIds.map((memberId) => ({
            memberId,
          })),
        },
      },
      include: {
        type: true,
        members: {
          include: {
            member: true,
          },
        },
      },
    });

    await this.logService.log(
      'CREATE',
      'expense',
      expense.id,
      {
        description: trimmedDescription,
        amount: normalizedAmount,
        typeId: normalizedTypeId,
        memberIds: normalizedMemberIds,
      },
    );

    return this.mapExpenseToDto(expense);
  }

  async findAll(): Promise<ExpenseDto[]> {
    const expenses = await this.prisma.expense.findMany({
      where: { bandId: this.requestContext.requireBandId(), deletedAt: null },
      include: {
        type: true,
        members: {
          include: {
            member: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return expenses.map((expense) => this.mapExpenseToDto(expense));
  }

  async update(id: number, dto: UpdateExpenseDto): Promise<ExpenseDto> {
    const bandId = this.requestContext.requireBandId();
    const existing = await this.prisma.expense.findFirst({ where: { id, bandId } });
    if (!existing || existing.deletedAt) {
      throw new BadRequestException('Expense not found.');
    }

    const data: any = {};

    if (dto.description !== undefined) {
      const trimmed = dto.description.trim();
      if (!trimmed) throw new BadRequestException('Description is required.');
      data.description = trimmed;
    }

    if (dto.amount !== undefined) {
      const num = Number(dto.amount);
      if (!Number.isFinite(num) || num === 0) throw new BadRequestException('Invalid amount.');
      data.amount = Math.round(num * 100) / 100;
    }

    if (dto.date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.date)) throw new BadRequestException('Invalid date format.');
      data.date = dto.date;
    }

    if (dto.paid !== undefined) {
      data.paid = Boolean(dto.paid);
    }

    if (dto.notes !== undefined) {
      data.notes = this.normalizeNotes(dto.notes);
    }

    if (dto.typeId !== undefined) {
      const typeId = parseInt(String(dto.typeId));
      const expenseType = await this.prisma.expenseType.findFirst({ where: { id: typeId, bandId } });
      if (!expenseType || expenseType.deletedAt) throw new BadRequestException('Invalid expense type.');
      data.fkType = typeId;
    }

    // Validate members before writing anything
    let normalizedMemberIds: number[] | undefined;
    if (dto.memberIds !== undefined) {
      normalizedMemberIds = Array.from(
        new Set(dto.memberIds.map((mid) => parseInt(String(mid))))
      );
      if (normalizedMemberIds.some((mid) => !(mid > 0))) {
        throw new BadRequestException('Invalid member in the list sent.');
      }
      await this.assertBandMembers(normalizedMemberIds, bandId);
    }

    // Update expense fields
    await this.prisma.expense.update({ where: { id }, data });

    // Update members if provided
    if (normalizedMemberIds !== undefined) {
      if (normalizedMemberIds.length === 0) {
        const activeMembers = await this.prisma.member.findMany({
          where: { bandId, active: true },
          select: { id: true },
        });
        normalizedMemberIds = activeMembers.map((m) => m.id);
      }

      // Delete old and insert new
      await this.prisma.expenseMember.deleteMany({ where: { expenseId: id } });
      await this.prisma.expenseMember.createMany({
        data: normalizedMemberIds.map((memberId) => ({ expenseId: id, memberId })),
      });

      await this.prisma.expense.update({
        where: { id },
        data: { fkMember: normalizedMemberIds[0] || null },
      });
    }

    const updated = await this.prisma.expense.findUnique({
      where: { id },
      include: { type: true, members: { include: { member: true } } },
    });

    await this.logService.log('UPDATE', 'expense', id, dto);

    return this.mapExpenseToDto(updated);
  }

  async delete(id: number): Promise<void> {
    const expense = await this.prisma.expense.findFirst({
      where: { id, bandId: this.requestContext.requireBandId() },
    });
    if (!expense) {
      throw new BadRequestException('Expense not found.');
    }

    await this.prisma.expense.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.logService.log(
      'DELETE',
      'expense',
      id,
      { description: expense?.description, amount: expense?.amount },
    );
  }

  async markPaid(ids: number[], paid: boolean): Promise<ExpenseDto[]> {
    const normalizedIds = Array.from(
      new Set((ids || []).map((id) => parseInt(String(id)))),
    ).filter((id) => Number.isFinite(id) && id > 0);

    if (normalizedIds.length === 0) {
      throw new BadRequestException('No expenses selected.');
    }

    const normalizedPaid = Boolean(paid);
    const bandId = this.requestContext.requireBandId();

    await this.prisma.expense.updateMany({
      where: { id: { in: normalizedIds }, bandId, deletedAt: null },
      data: { paid: normalizedPaid },
    });

    await this.logService.log('UPDATE', 'expense', undefined, {
      action: 'markPaid',
      ids: normalizedIds,
      paid: normalizedPaid,
    });

    const expenses = await this.prisma.expense.findMany({
      where: { id: { in: normalizedIds }, bandId, deletedAt: null },
      include: {
        type: true,
        members: { include: { member: true } },
      },
    });

    return expenses.map((expense) => this.mapExpenseToDto(expense));
  }

  async reportByMember(): Promise<ReportByMemberDto[]> {
    const members = await this.prisma.member.findMany({
      where: { bandId: this.requestContext.requireBandId() },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });

    const report: ReportByMemberDto[] = [];

    for (const member of members) {
      const expenseMembers = await this.prisma.expenseMember.findMany({
        where: { memberId: member.id },
      });

      let total = 0;

      for (const expenseMember of expenseMembers) {
        const expense = await this.prisma.expense.findUnique({
          where: { id: expenseMember.expenseId },
        });

        if (expense && !expense.deletedAt) {
          // Count how many members this expense is assigned to
          const memberCount = await this.prisma.expenseMember.count({
            where: { expenseId: expenseMember.expenseId },
          });

          const share =
            parseFloat(expense.amount.toString()) /
            Math.max(memberCount, 1);
          total += share;
        }
      }

      report.push({
        id: member.id,
        name: member.name,
        active: member.active,
        total,
      });
    }

    return report;
  }

  // Blank notes are stored as null, so an emptied field clears them.
  private normalizeNotes(notes: string | null | undefined): string | null {
    const trimmed = typeof notes === 'string' ? notes.trim() : '';
    return trimmed || null;
  }

  private mapExpenseToDto(expense: any): ExpenseDto {
    const memberIds = (expense.members || []).map((em: any) => em.memberId);
    const members = (expense.members || [])
      .map((em: any) => em.member?.name)
      .filter((name: any) => Boolean(name));

    const createdAt = typeof expense.createdAt === 'string' 
      ? expense.createdAt 
      : expense.createdAt.toISOString();

    return {
      id: expense.id,
      description: expense.description,
      typeId: expense.fkType ?? 1,
      typeName: expense.type?.name,
      amount: parseFloat(expense.amount.toString()),
      date: expense.date || createdAt.slice(0, 10),
      paid: Boolean(expense.paid),
      notes: expense.notes ?? null,
      createdAt,
      memberId: expense.fkMember,
      memberIds,
      members,
    };
  }
}
