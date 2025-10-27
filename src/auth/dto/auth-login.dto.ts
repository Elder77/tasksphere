import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AuthLoginDto {
  @ApiProperty({ example: '01020304050' })
  @IsString()
  @IsNotEmpty()
  usua_cedula: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  usua_password: string;
}
