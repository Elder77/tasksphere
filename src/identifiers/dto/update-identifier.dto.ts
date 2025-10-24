import { IsOptional, IsString, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateIdentifierDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  dataType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  minLength?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  maxLength?: number;
}
