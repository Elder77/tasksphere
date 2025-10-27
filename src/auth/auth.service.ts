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

  /**
   * Register a user into the database. If `username` looks like an email it will be used
   * as `email`, otherwise we synthesize a local email to satisfy the schema.
   */
  async register(usua_cedula: string, usua_nombres: string, password: string, perf_id: number = 1) {
    // Ensure caller provided a cédula and it doesn't exist already
    if (!usua_cedula) throw new BadRequestException('usua_cedula es requerido');
    const exists = await this.prisma.ticket_usuarios.findUnique({ where: { usua_cedula } });
    if (exists) throw new BadRequestException('usua_cedula ya existe');

  const hashed = await bcrypt.hash(password, 10);

    // derive email for Prisma User (email is unique and required)
    const usua_email = usua_nombres.includes('@') ? usua_nombres : `${usua_nombres}@local.test`;

    const user = await this.prisma.ticket_usuarios.create({
      data: {
        usua_cedula,
        usua_nombres,
        usua_apellidos: '',
        usua_password: hashed,
        usua_email,
        usua_celular: '0000000000',
        perf_id: perf_id,
        usua_activo: 'Y',
        usua_cambio_password: new Date(),
        usua_fecha_sistema: new Date(),
        proy_id: 1,
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
