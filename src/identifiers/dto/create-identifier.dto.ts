import { IsNotEmpty, IsString, IsOptional, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateIdentifierDto {
  @ApiProperty({ description: 'Nombre único del identificador' })
  @IsString()
  @IsNotEmpty()
  tiid_nombre: string;

  @ApiProperty({ description: 'Descripción del identificador', required: false })
  @IsOptional()
  @IsString()
  tiid_descripcion?: string;

  @ApiProperty({ description: 'Tipo de dato esperado (string, number, etc.)' })
  @IsString()
  @IsNotEmpty()
  tiid_tipo_dato: string;

  @ApiProperty({ description: 'Longitud mínima', required: false })
  @IsOptional()
  @IsInt()
  tiid_min_lenght?: number;

  @ApiProperty({ description: 'Longitud máxima', required: false })
  @IsOptional()
  @IsInt()
  tiid_max_lenght?: number;
}
