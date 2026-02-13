import { Module } from '@nestjs/common';
import { TicketProyectosService } from './projects.service';
import { TicketProyectosController } from './projects.controller';

@Module({
  imports: [],
  controllers: [TicketProyectosController],
  providers: [TicketProyectosService],
  exports: [TicketProyectosService],
})
export class ProjectsModule {}
