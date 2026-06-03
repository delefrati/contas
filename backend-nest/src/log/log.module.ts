import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { LogService } from './log.service';
import { LogController } from './log.controller';

@Module({
  imports: [PrismaModule, CommonModule],
  providers: [LogService],
  controllers: [LogController],
  exports: [LogService],
})
export class LogModule {}
