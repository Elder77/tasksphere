import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';

@Injectable()
export class TicketProyectosService {
  constructor(private prisma: PrismaService) {}

  findAll(q?: string) {
    const where: any = {};
    if (q && String(q).trim()) {
      where.tipr_nombre = { contains: String(q).trim(), mode: 'insensitive' };
    }
    return this.prisma.ticket_proyectos.findMany({ where, orderBy: { fecha_sistema: 'desc' } });
  }

  async findAllPaged(page = 1, perPage = 10, q?: string) {
    const p = Number(page) > 0 ? Number(page) : 1;
    const pp = Number(perPage) > 0 ? Math.min(Number(perPage), 100) : 10;
    const where: any = {};
    if (q && String(q).trim()) where.tipr_nombre = { contains: String(q).trim(), mode: 'insensitive' };
    const [total, data] = await Promise.all([
      this.prisma.ticket_proyectos.count({ where }),
      this.prisma.ticket_proyectos.findMany({ where, skip: (p - 1) * pp, take: pp, orderBy: { fecha_sistema: 'desc' } }),
    ]);
    return { data, meta: { total, page: p, perPage: pp, totalPages: Math.ceil(total / pp) } };
  }

  async findOne(tipr_id: number) {
    const p = await this.prisma.ticket_proyectos.findUnique({ where: { tipr_id } });
    if (!p) throw new NotFoundException('Proyecto no encontrado');
    return p;
  }

  create(dto: CreateProyectoDto) {
    return this.prisma.ticket_proyectos.create({ data: { tipr_nombre: dto.tipr_nombre, tipr_token: dto.tipr_token ?? null } });
  }

  update(tipr_id: number, dto: UpdateProyectoDto) {
    return this.prisma.ticket_proyectos.update({ where: { tipr_id }, data: dto });
  }

  remove(tipr_id: number) {
    return this.prisma.ticket_proyectos.delete({ where: { tipr_id } });
  }

  // return list of users assigned to a project (full user records)
  async getUsersForProject(tipr_id: number) {
    // only consider active assignments (tipr_estado = 'A') and return active admin users
    const rows = await this.prisma.ticket_proyecto_usuario.findMany({ where: { tipr_id, tipr_estado: 'A' } });
    const cedulas = rows.map((r) => r.usua_cedula).filter(Boolean) as string[];
    if (cedulas.length === 0) return [];
    return this.prisma.ticket_usuarios.findMany({ where: { usua_cedula: { in: cedulas }, perf_id: 2, usua_activo: 'A' } });
  }

  // set users for project: keep only users that exist and have perf_id = 2
  async setUsersForProject(tipr_id: number, usua_cedulas: string[]) {
    // find valid users (existing users with perf_id = 2 and active)
    const valid = await this.prisma.ticket_usuarios.findMany({ where: { usua_cedula: { in: usua_cedulas }, perf_id: 2, usua_activo: 'A' } });
    const validCedulas = valid.map((u) => u.usua_cedula);

    // fetch existing assignments for the project
    const existing = await this.prisma.ticket_proyecto_usuario.findMany({ where: { tipr_id } });
    const existingCedulas = existing.map((r) => r.usua_cedula).filter(Boolean) as string[];

    // compute which cedulas are new and which should be deactivated
    const toCreate = validCedulas.filter((c) => !existingCedulas.includes(c));
    const toActivate = validCedulas.filter((c) => existingCedulas.includes(c));
    // cedulas currently assigned but not in the new list should be marked as Inactive ('I')
    const toDeactivate = existingCedulas.filter((c) => !validCedulas.includes(c));

    // perform transaction: activate/update existing, deactivate removed, and create new rows
    await this.prisma.$transaction([
      // activate/update existing assignments
      this.prisma.ticket_proyecto_usuario.updateMany({ where: { tipr_id, usua_cedula: { in: toActivate } }, data: { tipr_estado: 'A', fecha_sistema: new Date() } }),
      // deactivate assignments that were removed
      this.prisma.ticket_proyecto_usuario.updateMany({ where: { tipr_id, usua_cedula: { in: toDeactivate } }, data: { tipr_estado: 'I' } }),
      // create new assignments
      this.prisma.ticket_proyecto_usuario.createMany({ data: toCreate.map((c) => ({ tipr_id, usua_cedula: c, tipr_estado: 'A', fecha_sistema: new Date() })) }),
    ]);

    return this.getUsersForProject(tipr_id);
  }
}
