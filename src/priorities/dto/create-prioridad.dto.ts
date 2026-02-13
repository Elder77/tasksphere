import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePrioridadDto {
  @ApiProperty({ description: 'Nombre de la prioridad' })
  @IsString()
  @IsNotEmpty()
  prio_nombre: string;

  @ApiProperty({ description: 'Estado', required: false })
  @IsOptional()
  @IsString()
  prio_estado?: string;
}
