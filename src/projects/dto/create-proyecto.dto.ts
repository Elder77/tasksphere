import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProyectoDto {
  @ApiProperty({ description: 'Nombre del proyecto' })
  @IsString()
  @IsNotEmpty()
  tipr_nombre: string;

  @ApiProperty({ description: 'Token público del proyecto', required: false })
  @IsOptional()
  @IsString()
  tipr_token?: string;
}
