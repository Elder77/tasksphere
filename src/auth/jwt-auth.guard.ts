import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
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
    } catch (e) {
      // ignore and try project token fallback below
    }

    // Fallback: try to treat provided token as a project token stored in `proyectos.proy_token`.
    const req = context.switchToHttp().getRequest();
    const auth = req.headers?.authorization || req.query?.token || null;
    if (!auth) throw new UnauthorizedException('No se encontró el token de autenticación');

    let token = String(auth || '');
    if (token.startsWith('Bearer ')) token = token.slice(7);

    const project = await this.prisma.proyectos.findFirst({ where: { proy_token: token } });
    if (project) {
      // attach lightweight project user to request so controllers/services can scope by proy_id
      req.user = { proy_id: project.proy_id, project_token: true };
      return true;
    }

    throw new UnauthorizedException('Token inválido');
  }
}
