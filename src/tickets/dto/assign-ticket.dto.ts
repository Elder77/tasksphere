import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignTicketDto {
  @ApiProperty({ description: 'ID del ticket' })
  @IsInt()
  ticket_id: number;

  @ApiProperty({ description: 'Cédula del usuario a asignar' })
  @IsString()
  @IsNotEmpty()
  tick_usuario_asignado: string;
}
