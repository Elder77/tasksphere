import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
// TasksModule removed per requirements (not used)
import { AuthModule } from './auth/auth.module';
// ChatModule removed per requirements (handled inside Tickets module)
import { TicketsModule } from './tickets/tickets.module';
import { IdentifiersModule } from './identifiers/identifiers.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    PrismaModule,
    AuthModule,
    TicketsModule,
    IdentifiersModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
