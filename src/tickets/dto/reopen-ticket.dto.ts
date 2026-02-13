import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReopenTicketDto {
  @ApiProperty({ description: 'Razón para reabrir el ticket' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
