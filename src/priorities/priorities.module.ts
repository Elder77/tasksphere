import { Module } from '@nestjs/common';
import { TicketPrioridadesService } from './priorities.service';
import { TicketPrioridadesController } from './priorities.controller';

@Module({
  imports: [],
  controllers: [TicketPrioridadesController],
  providers: [TicketPrioridadesService],
  exports: [TicketPrioridadesService],
})
export class PrioritiesModule {}
