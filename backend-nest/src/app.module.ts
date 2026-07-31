import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { ExpenseModule } from './expense/expense.module';
import { MemberModule } from './member/member.module';
import { ExpenseTypeModule } from './expense-type/expense-type.module';
import { LogModule } from './log/log.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { SongModule } from './song/song.module';
import { RepertoireModule } from './repertoire/repertoire.module';
import { RequestContextMiddleware } from './common/request-context.middleware';

@Module({
  imports: [PrismaModule, HealthModule, ExpenseModule, MemberModule, ExpenseTypeModule, LogModule, AuthModule, CommonModule, SongModule, RepertoireModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
