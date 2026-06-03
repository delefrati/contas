import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';

export class ExpenseDto {
  id!: number;
  description!: string;
  typeId!: number;
  typeName?: string;
  amount!: number;
  date!: string;
  createdAt!: string;
  memberId!: number | null;
  memberIds!: number[];
  members!: string[];
}

export class CreateExpenseDto {
  description!: string;
  typeId?: number;
  amount!: number;
  date?: string;
  memberIds?: number[];
}

export class UpdateExpenseDto {
  description?: string;
  typeId?: number;
  amount?: number;
  date?: string;
  memberIds?: number[];
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
  ) {}

  async create(createExpenseDto: CreateExpenseDto): Promise<ExpenseDto> {
    const { description, typeId, amount, date, memberIds = [] } = createExpenseDto;
    const numericAmount = Number(amount);
    const normalizedAmount = Math.round(numericAmount * 100) / 100;

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
        where: { deletedAt: null },
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

    const expenseType = await this.prisma.expenseType.findUnique({
      where: { id: normalizedTypeId },
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

    // If no members specified, apply to all active members
    if (normalizedMemberIds.length === 0) {
      const activeMembers = await this.prisma.member.findMany({
        where: { active: true },
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
        description: trimmedDescription,
        fkType: normalizedTypeId,
        amount: normalizedAmount,
        fkMember: normalizedMemberIds[0] || null,
        date: normalizedDate,
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
      where: { deletedAt: null },
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
    const existing = await this.prisma.expense.findUnique({ where: { id } });
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

    if (dto.typeId !== undefined) {
      const typeId = parseInt(String(dto.typeId));
      const expenseType = await this.prisma.expenseType.findUnique({ where: { id: typeId } });
      if (!expenseType || expenseType.deletedAt) throw new BadRequestException('Invalid expense type.');
      data.fkType = typeId;
    }

    // Update expense fields
    await this.prisma.expense.update({ where: { id }, data });

    // Update members if provided
    if (dto.memberIds !== undefined) {
      let normalizedMemberIds = Array.from(
        new Set(dto.memberIds.map((mid) => parseInt(String(mid))))
      );

      if (normalizedMemberIds.length === 0) {
        const activeMembers = await this.prisma.member.findMany({
          where: { active: true },
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
    const expense = await this.prisma.expense.findUnique({
      where: { id },
    });

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

  async reportByMember(): Promise<ReportByMemberDto[]> {
    const members = await this.prisma.member.findMany({
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
      createdAt,
      memberId: expense.fkMember,
      memberIds,
      members,
    };
  }
}
