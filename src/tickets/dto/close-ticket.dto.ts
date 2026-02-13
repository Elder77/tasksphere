import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CloseTicketDto {
  @ApiProperty({ description: 'Observación al cerrar el ticket' })
  @IsString()
  @IsNotEmpty()
  note: string;
}
