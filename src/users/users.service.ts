import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.ticket_usuarios.findMany();
  }

  async findAllPaged(page = 1, perPage = 10) {
    const p = Number(page) > 0 ? Number(page) : 1;
    const pp = Number(perPage) > 0 ? Math.min(Number(perPage), 100) : 10;
    const where: Prisma.ticket_usuariosWhereInput = {};
    const [total, data] = await Promise.all([
      this.prisma.ticket_usuarios.count({ where }),
      this.prisma.ticket_usuarios.findMany({
        where,
        skip: (p - 1) * pp,
        take: pp,
        orderBy: { usua_fecha_sistema: 'desc' },
      }),
    ]);
    return {
      data,
      meta: { total, page: p, perPage: pp, totalPages: Math.ceil(total / pp) },
    };
  }

  async findFiltered(query: unknown) {
    const where: Prisma.ticket_usuariosWhereInput = {};
    if (query && typeof query === 'object') {
      const q = query as Record<string, unknown>;
      if (typeof q.perf_id === 'string' || typeof q.perf_id === 'number')
        where.perf_id = Number(q.perf_id);
      if (typeof q.usua_estado === 'string')
        where.usua_activo = String(q.usua_estado);
      else if (typeof q.usua_activo === 'string')
        where.usua_activo = String(q.usua_activo);
      if (
        typeof q.usua_cedula === 'string' ||
        typeof q.usua_cedula === 'number'
      )
        where.usua_cedula = String(q.usua_cedula);
    }
    return this.prisma.ticket_usuarios.findMany({
      where,
      orderBy: { usua_fecha_sistema: 'desc' },
    });
  }

  async create(data: CreateUserDto) {
    // Requerir usua_cedula del solicitante. Si ya existe, rechazar.
    const exists = await this.prisma.ticket_usuarios.findUnique({
      where: { usua_cedula: data.usua_cedula },
    });
    if (exists) {
      // Devolver un objeto de error específico por campo para que el frontend lo muestre inline
      throw new BadRequestException({ usua_cedula: ['La cédula ya existe'] });
    }

    const password = data.usua_password ?? 'changeme';
    const hashed = await bcrypt.hash(password, 10);

    // Construir el payload que corresponde al esquema de Prisma (strings para celular, apellidos, etc.)
    const payload: Prisma.ticket_usuariosCreateInput = {
      usua_cedula: data.usua_cedula,
      usua_nombres: data.usua_nombres,
      usua_apellidos: data.usua_apellidos ?? '',
      usua_email: data.usua_email ?? `${data.usua_nombres}@local.test`,
      usua_password: hashed,
      // almacenar celular como string (la BD espera VarChar(10))
      usua_celular:
        data.usua_celular !== undefined && data.usua_celular !== null
          ? String(data.usua_celular)
          : '',
      usua_activo: 'A',
      usua_cambio_password: new Date(),
      // permitir al solicitante establecer perf_id si lo provee, de lo contrario por defecto 2 (soporte)
      perf_id: data.perf_id ?? 2,
      usua_fecha_sistema: new Date(),
    };

    try {
      const created = await this.prisma.ticket_usuarios.create({
        data: payload,
      });
      return created;
    } catch (errUnknown) {
      try {
        const err = errUnknown as unknown;
        if (err && typeof err === 'object') {
          const eObj = err as Record<string, unknown>;
          if (typeof eObj['code'] === 'string' && eObj['code'] === 'P2002') {
            const meta = eObj['meta'] as Record<string, unknown> | undefined;
            const target = meta?.['target'];
            let field: string | null = null;
            if (Array.isArray(target) && target.length)
              field = String(target[0]);
            else if (typeof target === 'string') field = target;
            const keyNorm = field
              ? String(field)
                  .toLowerCase()
                  .replace(/[^a-z0-9]/g, '')
              : null;
            const map: Record<string, string> = {
              usua_cedula: 'usua_cedula',
              cedula: 'usua_cedula',
              usua_email: 'usua_email',
              email: 'usua_cedula',
            };
            const mapped = keyNorm ? map[keyNorm] || field : field;
            if (mapped) {
              const obj: Record<string, unknown> = {};
              const msg =
                mapped === 'usua_email'
                  ? 'El email ya existe'
                  : 'La cédula ya existe';
              obj[mapped] = [msg];
              throw new BadRequestException(obj);
            }
          }
        }
      } catch (inner) {
        if (inner instanceof BadRequestException) throw inner;
      }

      const extractMessage = (e: unknown): string | undefined => {
        if (!e || typeof e !== 'object') return undefined;
        const o = e as Record<string, unknown>;
        if (typeof o['message'] === 'string') return o['message'];
        if (typeof o['response'] === 'object' && o['response'] !== null) {
          const r = o['response'] as Record<string, unknown>;
          if (typeof r['message'] === 'string') return r['message'];
        }
        return undefined;
      };

      const msg =
        extractMessage(errUnknown as unknown) ?? 'Error al crear usuario';
      throw new BadRequestException(msg);
    }
  }

  async update(usua_cedula: string, dto: Partial<CreateUserDto>) {
    // permitir actualizar campos básicos del usuario; la contraseña debe hashearse si se provee
    const data: Prisma.ticket_usuariosUpdateInput = {};
    if (dto.usua_nombres !== undefined) data.usua_nombres = dto.usua_nombres;
    if (dto.usua_apellidos !== undefined)
      data.usua_apellidos = dto.usua_apellidos;
    if (dto.usua_email !== undefined) data.usua_email = dto.usua_email;
    if (dto.usua_celular !== undefined) {
      // almacenar celular como string para coincidir con el esquema de Prisma (se aceptan varios formatos)
      data.usua_celular = String(dto.usua_celular ?? '');
    }
    if (dto.perf_id !== undefined) data.perf_id = dto.perf_id;
    // nota: el modelo ticket_usuarios no incluye la columna tipr_id en el esquema
    if (dto.usua_password !== undefined) {
      data.usua_password = await bcrypt.hash(dto.usua_password, 10);
    }

    const updated = await this.prisma.ticket_usuarios.update({
      where: { usua_cedula },
      data,
    });
    return updated;
  }
}
