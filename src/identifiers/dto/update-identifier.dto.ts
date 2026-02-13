import {
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateIdentifierDto {
  @ApiProperty({ description: 'Nombre del identificador' })
  @IsString()
  @IsNotEmpty()
  tiid_nombre: string;

  @ApiProperty({ description: 'Descripción del identificador' })
  @IsString()
  @IsNotEmpty()
  tiid_descripcion: string;

  @ApiProperty({ description: 'Tipo de dato del identificador' })
  @IsString()
  @IsNotEmpty()
  tiid_tipo_dato: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  tiid_min_lenght?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  tiid_max_lenght?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  tiid_solo_letras?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  tiid_alpha_numeric?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tiid_regex?: string;
}
