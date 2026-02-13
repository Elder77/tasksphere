import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateIdentifierDto {
  @ApiProperty({ description: 'Proyecto (tipr_id)', required: true })
  @IsInt({
    message: 'El proyecto (tipr_id) es obligatorio y debe ser numérico',
  })
  @IsNotEmpty({ message: 'El proyecto es obligatorio' })
  tipr_id: number;

  @ApiProperty({ description: 'Nombre único del identificador' })
  @IsString()
  @IsNotEmpty()
  tiid_nombre: string;

  @ApiProperty({ description: 'Descripción del identificador', required: true })
  @IsString({ message: 'La descripción debe ser un texto' })
  @IsNotEmpty({ message: 'La descripción del identificador es obligatoria' })
  tiid_descripcion: string;

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

  @ApiProperty({ description: 'Solo letras (true/false)', required: false })
  @IsOptional()
  @IsBoolean()
  tiid_solo_letras?: boolean;

  @ApiProperty({ description: 'Alfanumérico (true/false)', required: false })
  @IsOptional()
  @IsBoolean()
  tiid_alpha_numeric?: boolean;

  @ApiProperty({
    description: 'Expresión regular que debe cumplir el valor',
    required: false,
  })
  @IsOptional()
  @IsString()
  tiid_regex?: string;
}
