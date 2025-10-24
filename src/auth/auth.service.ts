import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  // keep a tiny in-memory fallback for legacy test users
  private users = [
    {
      id: 1,
      username: 'admin',
      password: '$2b$10$uP4Mmqkk5oC5ZC39sLzU..q5EUSy6JSeH7iHykVbOrGhnsWvfH7/G', // 123456
      role: 'admin',
    },
    {
      id: 2,
      username: 'user',
      password: '$2b$10$uP4Mmqkk5oC5ZC39sLzU..q5EUSy6JSeH7iHykVbOrGhnsWvfH7/G', // 123456
      role: 'user',
    },
  ];

  private nextId = this.users.length ? Math.max(...this.users.map((u) => u.id)) + 1 : 1;

  constructor(private jwtService: JwtService, private prisma: PrismaService) {}

  /**
   * Register a user into the database. If `username` looks like an email it will be used
   * as `email`, otherwise we synthesize a local email to satisfy the schema.
   */
  async register(username: string, password: string, role: string = 'user') {
    const hashed = await bcrypt.hash(password, 10);

    // derive email for Prisma User (email is unique and required)
    const email = username.includes('@') ? username : `${username}@local.test`;

    // try to create in the DB; if it fails due to unique constraint, surface a message
    const user = await this.prisma.user.create({
      data: {
        name: username,
        email,
        password: hashed,
        role,
      },
    });

    return { message: 'Usuario registrado', user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  }

  /**
   * Login: first try DB users (by email or name), else fallback to in-memory users (useful for tests).
   */
  async login(username: string, password: string) {
    // try DB lookup (by email or name)
    const user = await this.prisma.user.findFirst({ where: { OR: [{ email: username }, { name: username }] } });
    if (user) {
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) throw new UnauthorizedException('Credenciales inválidas');
      const payload = { username: user.name, sub: user.id, role: user.role };
      const token = await this.jwtService.signAsync(payload);
      return { access_token: token };
    }

    // fallback to in-memory users
    const mem = this.users.find((u) => u.username === username);
    if (!mem || !(await bcrypt.compare(password, mem.password))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const payload = { username: mem.username, sub: mem.id, role: mem.role };
    const token = await this.jwtService.signAsync(payload);
    return { access_token: token };
  }
}
