import { IsInt, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateTicketDto {
  @ApiProperty({ description: 'ID del identificador' })
  // Cuando se usan formularios multipart los valores vienen como texto; con `@Type(() => Number)`
  // convertimos automáticamente a number antes de la validación
  @Type(() => Number)
  @IsInt()
  tiid_id: number;

  @ApiProperty({ description: 'ID del proyecto' })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty({ message: 'El proyecto es obligatorio' })
  tipr_id: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tick_nombre: string;

  // Alias en inglés por compatibilidad con varios clientes
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tick_descripcion: string;

  // Alias en inglés
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tick_modulo: string;

  // Alias en inglés
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  module?: string;

  @ApiProperty({
    description:
      'Cédula del usuario creador (si no se proporciona se tomará del token)',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  usua_cedula?: string;
}
