import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTicketDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tick_descripcion?: string;

  // Alias en inglés
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tick_modulo?: string;

  // Alias en inglés
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  module?: string;

  // Permitir actualizar el nombre del ticket
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tick_nombre?: string;

  // Alias en inglés para tick_nombre
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    required: false,
    description:
      'Cédula del usuario que realiza la edición (opcional). Si se omite, se toma del token.',
  })
  @IsOptional()
  @IsString()
  usua_cedula?: string;
}
