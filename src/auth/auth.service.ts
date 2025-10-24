import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private users = [
    { 
      id: 1, 
      username: 'admin', 
      password: '$2b$10$uP4Mmqkk5oC5ZC39sLzU..q5EUSy6JSeH7iHykVbOrGhnsWvfH7/G', // 123456
      role: 'admin'
    },
    { 
      id: 2, 
      username: 'user', 
      password: '$2b$10$uP4Mmqkk5oC5ZC39sLzU..q5EUSy6JSeH7iHykVbOrGhnsWvfH7/G', // 123456
      role: 'user'
    }
  ];

  constructor(private jwtService: JwtService) {}

  async register(username: string, password: string, role: string = 'user') {
    const hashed = await bcrypt.hash(password, 10);
    const newUser = { id: Date.now(), username, password: hashed, role };
    this.users.push(newUser);
    return { message: 'Usuario registrado', user: newUser };
  }

  async login(username: string, password: string) {
    const user = this.users.find((u) => u.username === username);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = { username: user.username, sub: user.id, role: user.role };
    const token = await this.jwtService.signAsync(payload);
    return { access_token: token };
  }
}
