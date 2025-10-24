import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user, info, context: ExecutionContext) {
    if (err || !user) {
      // Puedes revisar el tipo de error si quieres mensajes más específicos
      if (info && info.message === 'No auth token') {
        throw new UnauthorizedException('No se encontró el token de autenticación');
      }

      if (info && info.message === 'invalid signature') {
        throw new UnauthorizedException('Token inválido');
      }

      if (info && info.message === 'jwt expired') {
        throw new UnauthorizedException('El token ha expirado');
      }

      throw new UnauthorizedException('No autorizado. Verifica tus credenciales.');
    }
    return user;
  }
}
