import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.ticket_usuarios.findMany();
  }

  async create(data: CreateUserDto) {
    // Require usua_cedula from caller. If already exists, reject.
    const exists = await this.prisma.ticket_usuarios.findUnique({ where: { usua_cedula: data.usua_cedula } });
    if (exists) throw new BadRequestException('Usua_cedula ya existe');

    const password = data.usua_password ?? 'changeme';
    const hashed = await bcrypt.hash(password, 10);

    const payload: any = {
      usua_cedula: data.usua_cedula,
      usua_nombres: data.usua_nombres,
      usua_apellidos: '',
      usua_email: data.usua_email ?? `${data.usua_nombres}@local.test`,
      usua_password: hashed,
      usua_celular: '0000000000',
      usua_activo: 'Y',
      usua_cambio_password: new Date(),
      perf_id: 2,
      proy_id: 1,
      usua_fecha_sistema: new Date(),
    };

    return this.prisma.ticket_usuarios.create({ data: payload });
  }
}