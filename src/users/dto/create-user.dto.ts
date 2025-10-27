import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: 'Cédula del usuario (PK en la tabla ticket_usuarios)' })
  @IsString()
  @IsNotEmpty()
  usua_cedula: string;

  @ApiProperty({ description: 'Nombres del usuario' })
  @IsString()
  @IsNotEmpty()
  usua_nombres: string;

  @ApiProperty({ description: 'Email del usuario', required: false })
  @IsOptional()
  @IsString()
  usua_email?: string;

  @ApiProperty({ description: 'Password del usuario', required: false })
  @IsOptional()
  @IsString()
  usua_password?: string;
}
