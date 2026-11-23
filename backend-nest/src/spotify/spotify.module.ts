import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LogModule } from '../log/log.module';
import { CommonModule } from '../common/common.module';
import { SpotifyService } from './spotify.service';
import { PlaylistService } from './playlist.service';
import { PlaylistController } from './playlist.controller';

@Module({
  imports: [PrismaModule, LogModule, CommonModule],
  controllers: [PlaylistController],
  providers: [SpotifyService, PlaylistService],
  exports: [SpotifyService],
})
export class SpotifyModule {}
