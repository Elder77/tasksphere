import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateTicketDto {
  @ApiProperty({ description: 'ID del identificador' })
  // Cuando se usan formularios multipart los valores vienen como texto; con `@Type(() => Number)`
  // convertimos automáticamente a number antes de la validación
  @Type(() => Number)
  @IsInt()
  identifierId: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  module: string;
}
