import { IsNotEmpty, IsString, IsOptional, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateIdentifierDto {
  @ApiProperty({ description: 'Nombre único del identificador' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Descripción del identificador', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Tipo de dato esperado (string, number, etc.)' })
  @IsString()
  @IsNotEmpty()
  dataType: string;

  @ApiProperty({ description: 'Longitud mínima', required: false })
  @IsOptional()
  @IsInt()
  minLength?: number;

  @ApiProperty({ description: 'Longitud máxima', required: false })
  @IsOptional()
  @IsInt()
  maxLength?: number;
}
