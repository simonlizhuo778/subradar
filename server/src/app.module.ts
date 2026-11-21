import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { BillsModule } from './bills/bills.module';
import { CandidatesModule } from './candidates/candidates.module';
import { CategoriesModule } from './categories/categories.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { RemindersModule } from './reminders/reminders.module';
import { StatsModule } from './stats/stats.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    SubscriptionsModule,
    CategoriesModule,
    StatsModule,
    AiModule,
    CandidatesModule,
    BillsModule,
    RemindersModule,
    NotificationsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
