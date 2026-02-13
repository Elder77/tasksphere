import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
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
    const where = {} as any;
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

  async findFiltered(query: any) {
    const where: any = {};
    if (query?.perf_id !== undefined) {
      where.perf_id = Number(query.perf_id);
    }
    // aceptar usua_estado o usua_activo desde el cliente
    if (query?.usua_estado !== undefined) {
      where.usua_activo = String(query.usua_estado);
    } else if (query?.usua_activo !== undefined) {
      where.usua_activo = String(query.usua_activo);
    }
    if (query?.usua_cedula) {
      where.usua_cedula = String(query.usua_cedula);
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
    const payload: any = {
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
    } catch (e: any) {
      // Convertir errores de Prisma/internos a BadRequestException legible cuando sea posible
      // Manejar errores de constraint único (P2002) y mapearlos a campo->mensajes para que el frontend muestre inline
      try {
        if (e && e.code === 'P2002') {
          // e.meta.target puede ser el nombre de la columna o un arreglo de columnas
          const target = e?.meta?.target;
          let field: string | null = null;
          if (Array.isArray(target) && target.length) field = String(target[0]);
          else if (typeof target === 'string') field = target;
          // normalizar tokens de campo a claves conocidas
          const keyNorm = field
            ? String(field)
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '')
            : null;
          const map: Record<string, string> = {
            usua_cedula: 'usua_cedula',
            cedula: 'usua_cedula',
            usua_email: 'usua_email',
            email: 'usua_email',
          };
          const mapped = keyNorm ? map[keyNorm] || field : field;
          const obj: any = {};
          if (mapped) {
            // user-friendly Spanish message
            const msg =
              mapped === 'usua_email'
                ? 'El email ya existe'
                : 'La cédula ya existe';
            obj[mapped] = [msg];
            throw new BadRequestException(obj);
          }
        }
      } catch (inner) {
        // si lanzamos BadRequestException arriba, relanzarlo
        if (inner instanceof BadRequestException) throw inner;
      }

      const msg = e && e.message ? String(e.message) : 'Error al crear usuario';
      throw new BadRequestException(msg);
    }
  }

  async update(usua_cedula: string, dto: Partial<CreateUserDto>) {
    // permitir actualizar campos básicos del usuario; la contraseña debe hashearse si se provee
    const data: any = {};
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
