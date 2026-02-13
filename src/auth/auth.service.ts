import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  // keep a tiny in-memory fallback for legacy test users
  // Note: perf_id: 1 => regular user, 2 => admin
  private users = [
    {
      usua_cedula: '00000000001',
      usua_nombres: 'admin',
      usua_password: '$2b$10$uP4Mmqkk5oC5ZC39sLzU..q5EUSy6JSeH7iHykVbOrGhnsWvfH7/G', // 123456
      perf_id: 2,
    },
    {
      usua_cedula: '00000000002',
      usua_nombres: 'user',
      usua_password: '$2b$10$uP4Mmqkk5oC5ZC39sLzU..q5EUSy6JSeH7iHykVbOrGhnsWvfH7/G', // 123456
      perf_id: 1,
    },
  ];


  constructor(private jwtService: JwtService, private prisma: PrismaService) {}


  async register(usua_cedula: string, usua_nombres: string, usua_apellidos: string, usua_email: string, usua_celular: string, password: string, perf_id: number = 1) {
    // Ensure caller provided a cédula and it doesn't exist already
    if (!usua_cedula) throw new BadRequestException('usua_cedula es requerido');
    const exists = await this.prisma.ticket_usuarios.findUnique({ where: { usua_cedula } });
    if (exists) throw new BadRequestException('usua_cedula ya existe');

  const hashed = await bcrypt.hash(password, 10);


    const user = await this.prisma.ticket_usuarios.create({
      data: {
        usua_cedula,
        usua_nombres,
        usua_apellidos: usua_apellidos,
        usua_password: hashed,
        usua_email,
  usua_celular: (usua_celular as unknown) as any,
        perf_id: perf_id,
        usua_activo: 'A',
        usua_cambio_password: new Date(),
  usua_fecha_sistema: new Date(),
      },
    });

    return { message: 'Usuario registrado', user: { usua_cedula: user.usua_cedula, usua_nombres: user.usua_nombres, usua_email: user.usua_email } };
  }

  /**
   * Login: first try DB users (by email or name), else fallback to in-memory users (useful for tests).
   */
  async login(usua_cedula: string, password: string) {
    // try DB lookup by cédula
    const user = await this.prisma.ticket_usuarios.findUnique({ where: { usua_cedula } });
    if (user) {
      // only allow login if usua_login flag is explicitly 'Si'
      if (String(user.usua_login).toLowerCase() !== 'si') {
        // give a generic unauthorized to avoid leaking info
        throw new UnauthorizedException('Credenciales inválidas o usuario no habilitado para login');
      }
      const ok = await bcrypt.compare(password, user.usua_password);
      if (!ok) throw new UnauthorizedException('Credenciales inválidas');
      const payload = { usua_nombres: user.usua_nombres, sub: user.usua_cedula, perf_id: user.perf_id };
      const token = await this.jwtService.signAsync(payload);
      return { access_token: token };
    }

    // fallback to in-memory users by cedula
    const mem = this.users.find((u) => u.usua_cedula === usua_cedula);
    if (!mem || !(await bcrypt.compare(password, mem.usua_password))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const payload = { usua_nombres: mem.usua_nombres, sub: mem.usua_cedula, perf_id: mem.perf_id };
    const token = await this.jwtService.signAsync(payload);
    return { access_token: token };
  }
}
