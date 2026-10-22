import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { LogModule } from '../log/log.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, LogModule, CommonModule],
  controllers: [EventController],
  providers: [EventService],
})
export class EventModule {}
