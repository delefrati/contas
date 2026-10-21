import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { BandService } from './band.service';
import { BandController } from './band.controller';

@Module({
  imports: [PrismaModule, CommonModule],
  providers: [BandService],
  controllers: [BandController],
  exports: [BandService],
})
export class BandModule {}
