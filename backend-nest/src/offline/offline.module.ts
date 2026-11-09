import { Module } from '@nestjs/common';
import { BandModule } from '../band/band.module';
import { CommonModule } from '../common/common.module';
import { EventModule } from '../event/event.module';
import { EventTypeModule } from '../event-type/event-type.module';
import { SongModule } from '../song/song.module';
import { OfflineController } from './offline.controller';
import { OfflineService } from './offline.service';

@Module({
  imports: [BandModule, CommonModule, EventModule, EventTypeModule, SongModule],
  controllers: [OfflineController],
  providers: [OfflineService],
})
export class OfflineModule {}
