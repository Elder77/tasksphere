import { IsString, IsNotEmpty, IsOptional, IsInt, Length, IsEmail, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: 'Cédula del usuario (PK en la tabla ticket_usuarios)' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 11)
  usua_cedula: string;

  @ApiProperty({ description: 'Nombres del usuario' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 30)
  usua_nombres: string;

  @ApiProperty({ description: 'Email del usuario', required: false })
  @IsOptional()
  @IsString()
  @IsEmail()
  usua_email?: string;

  @ApiProperty({ description: 'Apellidos del usuario', required: false })
  @IsOptional()
  @IsString()
  @Length(0, 30)
  usua_apellidos?: string;

  @ApiProperty({ description: 'Celular del usuario', required: false })
  @IsOptional()
  @IsString()
  @Length(6, 20)
  @Matches(/^[0-9+()\-\s]*$/)
  usua_celular?: string;

  @ApiProperty({ description: 'Perfil (perf_id)', required: false })
  @IsOptional()
  @IsInt()
  perf_id?: number;

  @ApiProperty({ description: 'Proyecto (tipr_id)', required: false })
  @IsOptional()
  @IsInt()
  tipr_id?: number;

  @ApiProperty({ description: 'Password del usuario', required: false })
  @IsOptional()
  @IsString()
  @Length(6, 128)
  usua_password?: string;
}
