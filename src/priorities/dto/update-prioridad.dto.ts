import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePrioridadDto {
  @ApiPropertyOptional({ description: 'Nombre de la prioridad' })
  @IsOptional()
  @IsString()
  prio_nombre?: string;

  @ApiPropertyOptional({ description: 'Estado' })
  @IsOptional()
  @IsString()
  prio_estado?: string;
}
