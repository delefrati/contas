import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';

export class ExpenseTypeDto {
  id!: number;
  name!: string;
  deletedAt!: string | null;
}

export class CreateExpenseTypeDto {
  name!: string;
}

@Injectable()
export class ExpenseTypeService {
  constructor(
    private prisma: PrismaService,
    private logService: LogService,
  ) {}

  async findAll(includeDeleted = false): Promise<ExpenseTypeDto[]> {
    const types = await this.prisma.expenseType.findMany({
      where: includeDeleted ? undefined : { deletedAt: null },
      orderBy: { name: 'asc' },
    });

    return types.map((type) => ({
      id: type.id,
      name: type.name,
      deletedAt: type.deletedAt ? type.deletedAt.toISOString() : null,
    }));
  }

  async create(createExpenseTypeDto: CreateExpenseTypeDto): Promise<ExpenseTypeDto> {
    const trimmedName = createExpenseTypeDto?.name?.trim() || '';
    if (!trimmedName) {
      throw new BadRequestException('Expense type name is required.');
    }

    const activeType = await this.prisma.expenseType.findFirst({
      where: {
        name: trimmedName,
        deletedAt: null,
      },
    });

    if (activeType) {
      throw new ConflictException('Expense type already exists.');
    }

    const deletedType = await this.prisma.expenseType.findFirst({
      where: {
        name: trimmedName,
        deletedAt: { not: null },
      },
    });

    const type = deletedType
      ? await this.prisma.expenseType.update({
          where: { id: deletedType.id },
          data: { deletedAt: null },
        })
      : await this.prisma.expenseType.create({
          data: { name: trimmedName },
        });

    await this.logService.log(
      deletedType ? 'RESTORE' : 'CREATE',
      'expenseType',
      type.id,
      { name: trimmedName },
    );

    return {
      id: type.id,
      name: type.name,
      deletedAt: type.deletedAt ? type.deletedAt.toISOString() : null,
    };
  }

  async softDelete(id: number): Promise<void> {
    const type = await this.prisma.expenseType.findUnique({
      where: { id },
      select: { id: true, deletedAt: true, name: true },
    });

    if (!type) {
      throw new NotFoundException('Expense type not found.');
    }

    if (type.deletedAt) {
      return;
    }

    await this.prisma.expenseType.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.logService.log(
      'DELETE',
      'expenseType',
      id,
      { name: type.name },
    );
  }
}
