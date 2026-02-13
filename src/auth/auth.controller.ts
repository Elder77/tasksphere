import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthLoginDto } from './dto/auth-login.dto';
import { AuthRegisterDto } from './dto/auth-register.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Registrar usuario',
    description:
      'Registra un usuario de prueba. Devuelve datos del usuario (no recomendado para producción sin validaciones extra).',
  })
  @ApiBody({ type: AuthRegisterDto })
  @ApiResponse({ status: 201, description: 'Usuario registrado' })
  register(@Body() body: AuthRegisterDto) {
    const perf = Number(body.perf_id ?? 1);
    return this.authService.register(
      body.usua_cedula,
      body.usua_nombres,
      body.usua_apellidos,
      body.usua_email,
      body.usua_celular,
      body.usua_password,
      perf,
    );
  }

  @Post('login')
  @ApiOperation({
    summary: 'Login',
    description: 'Inicia sesión y devuelve un token JWT (access_token).',
  })
  @ApiBody({ type: AuthLoginDto })
  @ApiResponse({
    status: 201,
    description: 'Token de acceso',
    schema: { example: { access_token: 'eyJhbGciOi...' } },
  })
  login(@Body() body: AuthLoginDto) {
    return this.authService.login(body.usua_cedula, body.usua_password);
  }
}
