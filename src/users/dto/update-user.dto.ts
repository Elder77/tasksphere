import {
  IsString,
  IsOptional,
  IsInt,
  Length,
  IsEmail,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'Nombres del usuario' })
  @IsOptional()
  @IsString()
  @Length(2, 30)
  usua_nombres?: string;

  @ApiPropertyOptional({ description: 'Apellidos del usuario' })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  usua_apellidos?: string;

  @ApiPropertyOptional({ description: 'Email del usuario' })
  @IsOptional()
  @IsString()
  @IsEmail()
  usua_email?: string;

  @ApiPropertyOptional({ description: 'Celular del usuario' })
  @IsOptional()
  @IsString()
  @Length(6, 20)
  @Matches(/^[0-9+()\-\s]*$/)
  usua_celular?: string;

  @ApiPropertyOptional({ description: 'Password del usuario' })
  @IsOptional()
  @IsString()
  usua_password?: string;

  @ApiPropertyOptional({ description: 'Perfil (perf_id)' })
  @IsOptional()
  @IsInt()
  perf_id?: number;

  @ApiPropertyOptional({ description: 'Proyecto (tipr_id)' })
  @IsOptional()
  @IsInt()
  tipr_id?: number;
}
