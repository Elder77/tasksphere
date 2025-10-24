import { Module } from '@nestjs/common';
import { IdentifiersService } from './identifiers.service';
import { IdentifiersController } from './identifiers.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [IdentifiersService],
  controllers: [IdentifiersController],
  exports: [IdentifiersService],
})
export class IdentifiersModule {}
