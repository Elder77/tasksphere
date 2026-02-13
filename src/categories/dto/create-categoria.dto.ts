import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoriaDto {
  @ApiProperty({ description: 'Nombre de la categoría' })
  @IsString()
  @IsNotEmpty()
  tica_nombre: string;

  @ApiProperty({ description: 'Estado', required: false })
  @IsOptional()
  @IsString()
  tica_estado?: string;
}
