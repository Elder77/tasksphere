import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { ChatGateway } from './chat.gateway';
import { ChatDocsController } from './chat.docs.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { CategoriesModule } from '../categories/categories.module';
import { PrioritiesModule } from '../priorities/priorities.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getJwtSecret(),
      }),
      inject: [ConfigService],
    }),
    CategoriesModule,
    PrioritiesModule,
    ProjectsModule,
    // notificaciones para asignaciones de ticket y chat
    NotificationsModule,
  ],
  controllers: [TicketsController, ChatDocsController],
  providers: [TicketsService, ChatGateway],
  exports: [TicketsService],
})
export class TicketsModule {}
