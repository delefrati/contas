import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LogModule } from '../log/log.module';
import { SpotifyService } from './spotify.service';

@Module({
  imports: [PrismaModule, LogModule],
  providers: [SpotifyService],
  exports: [SpotifyService],
})
export class SpotifyModule {}
