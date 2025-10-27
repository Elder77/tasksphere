import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTicketDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tick_descripcion?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tick_modulo?: string;

  @ApiProperty({ required: false, description: 'Cédula del usuario que realiza la edición (opcional). Si se omite, se toma del token.' })
  @IsOptional()
  @IsString()
  usua_cedula?: string;
}
