import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreatePrioridadDto } from './dto/create-prioridad.dto';
import { UpdatePrioridadDto } from './dto/update-prioridad.dto';

@Injectable()
export class TicketPrioridadesService {
  constructor(private prisma: PrismaService) {}

  findAll(q?: string) {
    const where: Prisma.ticket_prioridadesWhereInput =
      q && String(q).trim()
        ? { prio_nombre: { contains: String(q).trim() } }
        : {};
    return this.prisma.ticket_prioridades.findMany({
      where,
      orderBy: { fecha_sistema: 'desc' },
    });
  }

  async findAllPaged(page = 1, perPage = 10, q?: string) {
    const p = Number(page) > 0 ? Number(page) : 1;
    const pp = Number(perPage) > 0 ? Math.min(Number(perPage), 100) : 10;
    const where: Prisma.ticket_prioridadesWhereInput =
      q && String(q).trim()
        ? { prio_nombre: { contains: String(q).trim() } }
        : {};
    const [total, data] = await Promise.all([
      this.prisma.ticket_prioridades.count({ where }),
      this.prisma.ticket_prioridades.findMany({
        where,
        skip: (p - 1) * pp,
        take: pp,
        orderBy: { fecha_sistema: 'desc' },
      }),
    ]);
    const totalPages = Math.ceil(total / pp);
    const from = total === 0 ? 0 : (p - 1) * pp + 1;
    const to = total === 0 ? 0 : Math.min(p * pp, total);
    const range = total === 0 ? `Mostrando 0 de 0` : `Mostrando del ${from} al ${to} de ${total}`;
    return {
      data,
      meta: { total, page: p, perPage: pp, totalPages, from, to, range },
    };
  }

  async findOne(prio_id: number) {
    const p = await this.prisma.ticket_prioridades.findUnique({
      where: { prio_id },
    });
    if (!p) throw new NotFoundException('Prioridad no encontrada');
    return p;
  }

  create(dto: CreatePrioridadDto) {
    return this.prisma.ticket_prioridades.create({
      data: {
        prio_nombre: dto.prio_nombre,
        prio_estado: dto.prio_estado ?? 'A',
      },
    });
  }

  update(prio_id: number, dto: UpdatePrioridadDto) {
    return this.prisma.ticket_prioridades.update({
      where: { prio_id },
      data: dto,
    });
  }

  remove(prio_id: number) {
    return this.prisma.ticket_prioridades.delete({ where: { prio_id } });
  }
}
