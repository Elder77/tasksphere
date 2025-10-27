import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AuthRegisterDto {
  @ApiProperty({ example: 'newuser' })
  @IsString()
  @IsNotEmpty()
  usua_nombres: string;

  @ApiProperty({ example: '01020304050' })
  @IsString()
  @IsNotEmpty()
  usua_cedula: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  usua_password: string;

  @ApiProperty({ example: 1, required: false, description: 'Perfil del usuario: 1=usuario, 2=admin' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  perf_id?: number;
}
