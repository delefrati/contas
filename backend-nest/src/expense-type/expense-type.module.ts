import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ExpenseTypeController } from './expense-type.controller';
import { ExpenseTypeService } from './expense-type.service';
import { LogModule } from '../log/log.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, LogModule, CommonModule],
  controllers: [ExpenseTypeController],
  providers: [ExpenseTypeService],
})
export class ExpenseTypeModule {}
