import { Module } from '@nestjs/common';
import { TicketCategoriasService } from './categories.service';
import { TicketCategoriasController } from './categories.controller';

@Module({
  imports: [],
  controllers: [TicketCategoriasController],
  providers: [TicketCategoriasService],
  exports: [TicketCategoriasService],
})
export class CategoriesModule {}
