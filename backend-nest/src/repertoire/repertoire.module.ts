import { Module } from '@nestjs/common';
import { RepertoireService } from './repertoire.service';
import { RepertoireController } from './repertoire.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { LogModule } from '../log/log.module';

@Module({
  imports: [PrismaModule, LogModule],
  controllers: [RepertoireController],
  providers: [RepertoireService],
})
export class RepertoireModule {}
