import { Module } from '@nestjs/common';
import { EventTypeService } from './event-type.service';
import { EventTypeController } from './event-type.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { LogModule } from '../log/log.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, LogModule, CommonModule],
  controllers: [EventTypeController],
  providers: [EventTypeService],
})
export class EventTypeModule {}
