import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { ChatGateway } from './chat.gateway';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      secret: 'mi_secreto_super_seguro', // mirror auth module secret; consider using env var
    }),
  ],
  controllers: [TicketsController],
  providers: [TicketsService, ChatGateway],
  exports: [TicketsService],
})
export class TicketsModule {}
