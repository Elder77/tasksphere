import { IsInt, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignTicketDto {
  @ApiProperty({ description: 'ID del ticket' })
  @IsInt()
  ticket_id: number;

  @ApiProperty({ description: 'Cédula del usuario a asignar' })
  @IsString()
  @IsNotEmpty()
  tick_usuario_asignado: string;

  @ApiProperty({ description: 'ID de categoría (opcional)', required: false })
  @IsOptional()
  @IsInt()
  tica_id?: number;

  @ApiProperty({ description: 'ID de prioridad (opcional)', required: false })
  @IsOptional()
  @IsInt()
  prio_id?: number;
}
