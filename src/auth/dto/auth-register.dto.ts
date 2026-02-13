import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AuthRegisterDto {
  @ApiProperty({ example: 'newuser' })
  @IsString()
  @IsNotEmpty()
  usua_nombres: string;

  @ApiProperty({ example: 'newuser' })
  @IsString()
  @IsNotEmpty()
  usua_apellidos: string;

  @ApiProperty({ example: '01020304050' })
  @IsString()
  @IsNotEmpty()
  usua_cedula: string;

  @ApiProperty({ example: 'correo@correo.com' })
  @IsString()
  @IsNotEmpty()
  usua_email: string;

  @ApiProperty({
    example: '3333333333',
    description: 'Número de celular del usuario',
  })
  @IsString()
  @IsNotEmpty()
  usua_celular: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  usua_password: string;

  @ApiProperty({
    example: 1,
    required: false,
    description: 'Perfil del usuario: 1=usuario, 2=admin',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  perf_id?: number;
}
