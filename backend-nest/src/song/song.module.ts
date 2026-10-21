import { Module } from '@nestjs/common';
import { SongService } from './song.service';
import { SongController } from './song.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { LogModule } from '../log/log.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, LogModule, CommonModule],
  controllers: [SongController],
  providers: [SongService],
})
export class SongModule {}
