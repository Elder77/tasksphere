import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { ChatGateway } from './chat.gateway';
import { ChatDocsController } from './chat.docs.controller';
import { JwtModule } from '@nestjs/jwt';
import { CategoriesModule } from '../categories/categories.module';
import { PrioritiesModule } from '../priorities/priorities.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    JwtModule.register({
      secret: 'mi_secreto_super_seguro', // refleja el secreto del módulo de auth; considerar usar una variable de entorno
    }),
    CategoriesModule,
    PrioritiesModule,
    ProjectsModule,
    // notificaciones para asignaciones de ticket y chat
    require('../notifications/notifications.module').NotificationsModule,
  ],
  controllers: [TicketsController, ChatDocsController],
  providers: [TicketsService, ChatGateway],
  exports: [TicketsService],
})
export class TicketsModule {}
