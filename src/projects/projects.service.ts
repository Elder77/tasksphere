import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';

@Injectable()
export class TicketProyectosService {
  constructor(private prisma: PrismaService) {}

  findAll(q?: string) {
    const where: Prisma.ticket_proyectosWhereInput =
      q && String(q).trim()
        ? { tipr_nombre: { contains: String(q).trim() } }
        : {};
    return this.prisma.ticket_proyectos.findMany({
      where,
      orderBy: { fecha_sistema: 'desc' },
    });
  }

  async findAllPaged(page = 1, perPage = 10, q?: string) {
    const p = Number(page) > 0 ? Number(page) : 1;
    const pp = Number(perPage) > 0 ? Math.min(Number(perPage), 100) : 10;
    const where: Prisma.ticket_proyectosWhereInput =
      q && String(q).trim()
        ? { tipr_nombre: { contains: String(q).trim() } }
        : {};
    const [total, data] = await Promise.all([
      this.prisma.ticket_proyectos.count({ where }),
      this.prisma.ticket_proyectos.findMany({
        where,
        skip: (p - 1) * pp,
        take: pp,
        orderBy: { fecha_sistema: 'desc' },
      }),
    ]);
    const totalPages = Math.ceil(total / pp);
    const from = total === 0 ? 0 : (p - 1) * pp + 1;
    const to = total === 0 ? 0 : Math.min(p * pp, total);

    const range =
      total === 0 ? `Mostrando 0 de 0` : `Mostrando del ${from} al ${to} de ${total}`;

    return {
      data,
      meta: { total, page: p, perPage: pp, totalPages, from, to, range },
    };
  }

  async findOne(tipr_id: number) {
    const p = await this.prisma.ticket_proyectos.findUnique({
      where: { tipr_id },
    });
    if (!p) throw new NotFoundException('Proyecto no encontrado');
    return p;
  }

  create(dto: CreateProyectoDto) {
    return this.prisma.ticket_proyectos.create({
      data: {
        tipr_nombre: dto.tipr_nombre,
        tipr_token: dto.tipr_token ?? null,
      },
    });
  }

  update(tipr_id: number, dto: UpdateProyectoDto) {
    return this.prisma.ticket_proyectos.update({
      where: { tipr_id },
      data: dto,
    });
  }

  remove(tipr_id: number) {
    return this.prisma.ticket_proyectos.delete({ where: { tipr_id } });
  }

  // Devuelve la lista de usuarios asignados a un proyecto (registros completos)
  async getUsersForProject(tipr_id: number) {
    // Considerar sólo asignaciones activas (tipr_estado = 'A') y devolver usuarios admin activos
    const rows = await this.prisma.ticket_proyecto_usuario.findMany({
      where: { tipr_id, tipr_estado: 'A' },
    });
    const cedulas = rows.map((r) => r.usua_cedula).filter(Boolean) as string[];
    if (cedulas.length === 0) return [];
    return this.prisma.ticket_usuarios.findMany({
      where: { usua_cedula: { in: cedulas }, perf_id: 2, usua_activo: 'A' },
    });
  }

  // Establece usuarios para un proyecto: conservar sólo usuarios existentes con perf_id = 2
  async setUsersForProject(tipr_id: number, usua_cedulas: string[]) {
    // Buscar usuarios válidos (existentes, con perf_id = 2 y activos)
    const valid = await this.prisma.ticket_usuarios.findMany({
      where: {
        usua_cedula: { in: usua_cedulas },
        perf_id: 2,
        usua_activo: 'A',
      },
    });
    const validCedulas = valid.map((u) => u.usua_cedula);

    // Obtener las asignaciones actuales para el proyecto
    const existing = await this.prisma.ticket_proyecto_usuario.findMany({
      where: { tipr_id },
    });
    const existingCedulas = existing
      .map((r) => r.usua_cedula)
      .filter(Boolean) as string[];

    // Calcular qué cédulas son nuevas y cuáles deben desactivarse
    const toCreate = validCedulas.filter((c) => !existingCedulas.includes(c));
    const toActivate = validCedulas.filter((c) => existingCedulas.includes(c));
    // Las cédulas actualmente asignadas que no estén en la nueva lista deben marcarse como Inactivas ('I')
    const toDeactivate = existingCedulas.filter(
      (c) => !validCedulas.includes(c),
    );

    // Ejecutar transacción: activar/actualizar existentes, desactivar los eliminados y crear nuevas filas
    await this.prisma.$transaction([
      // activar/actualizar asignaciones existentes
      this.prisma.ticket_proyecto_usuario.updateMany({
        where: { tipr_id, usua_cedula: { in: toActivate } },
        data: { tipr_estado: 'A', fecha_sistema: new Date() },
      }),
      // desactivar asignaciones que fueron removidas
      this.prisma.ticket_proyecto_usuario.updateMany({
        where: { tipr_id, usua_cedula: { in: toDeactivate } },
        data: { tipr_estado: 'I' },
      }),
      // crear nuevas asignaciones
      this.prisma.ticket_proyecto_usuario.createMany({
        data: toCreate.map((c) => ({
          tipr_id,
          usua_cedula: c,
          tipr_estado: 'A',
          fecha_sistema: new Date(),
        })),
      }),
    ]);

    return this.getUsersForProject(tipr_id);
  }
}
