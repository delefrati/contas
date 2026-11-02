import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { LogModule } from '../log/log.module';
import { MemberModule } from '../member/member.module';
import { AuthModule } from '../auth/auth.module';
import { BandModule } from '../band/band.module';
import { AdminService } from './admin.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminAuthController, AdminController } from './admin.controller';

@Module({
  imports: [PrismaModule, CommonModule, LogModule, MemberModule, AuthModule, BandModule],
  providers: [AdminService, AdminAuthGuard],
  controllers: [AdminAuthController, AdminController],
})
export class AdminModule {}
