import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private prisma: PrismaService) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    // First try regular JWT authentication provided by passport
    try {
      const result = (await super.canActivate(context)) as boolean;
      if (result) return true;
    } catch {
      // ignore and try project token fallback below
    }

    // Fallback: try to treat provided token as a project token stored in `proyectos.proy_token`.
    const req = context.switchToHttp().getRequest<Request>();

    // Accept token from several common locations to be more tolerant with clients / Swagger UI
    const headers = req.headers as Record<
      string,
      string | string[] | undefined
    >;
    const headerAuthRaw =
      headers?.authorization ||
      headers?.Authorization ||
      headers?.['x-access-token'] ||
      headers?.['x-token'] ||
      headers?.token;
    const headerAuth =
      typeof headerAuthRaw === 'string'
        ? headerAuthRaw
        : Array.isArray(headerAuthRaw)
          ? headerAuthRaw[0]
          : undefined;
    const bodyToken = (req.body as { token?: string })?.token;
    const queryToken = (req.query as { token?: string })?.token;
    const auth = headerAuth || queryToken || bodyToken || null;
    if (!auth) throw new UnauthorizedException('No se encuentra autenticado');

    let token = String(auth || '');
    if (token.startsWith('Bearer ')) token = token.slice(7);

    // check against ticket_proyectos.tipr_token (backwards-compatible: expose as tipr_id)
    const project = await this.prisma.ticket_proyectos.findFirst({
      where: { tipr_token: token },
    });
    if (project) {
      // attach lightweight project user to request so controllers/services can scope by tipr_id
      // keep property name `tipr_id` for backward compatibility but use tipr_id value
      req.user = { tipr_id: project.tipr_id, project_token: true };
      return true;
    }

    throw new UnauthorizedException('Token inválido');
  }
}
