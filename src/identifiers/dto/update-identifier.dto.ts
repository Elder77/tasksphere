import { IsOptional, IsString, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateIdentifierDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tiid_nombre?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tiid_descripcion?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tiid_tipo_dato?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  tiid_min_lenght?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  tiid_max_lenght?: number;
}
