import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProyectoDto {
  @ApiPropertyOptional({ description: 'Nombre del proyecto' })
  @IsOptional()
  @IsString()
  tipr_nombre?: string;

  @ApiPropertyOptional({ description: 'Token público del proyecto' })
  @IsOptional()
  @IsString()
  tipr_token?: string;
}
