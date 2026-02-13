import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );
    if (!requiredRoles) return true;

    const req = context
      .switchToHttp()
      .getRequest<{ user?: { perf_id?: number } }>();
    const user = req.user;

    // Map simple role names to perf_id values: 'user' -> 1, 'admin' -> 2
    const allowed = requiredRoles.some((r) => {
      const num = Number(r);
      if (!isNaN(num)) return user?.perf_id === num;
      if (r === 'admin' && user?.perf_id === 2) return true;
      if (r === 'user' && user?.perf_id === 1) return true;
      return false;
    });

    if (!allowed) {
      throw new ForbiddenException(
        'No tienes permisos para acceder a esta ruta',
      );
    }

    return true;
  }
}
