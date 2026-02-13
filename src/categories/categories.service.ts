import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';

@Injectable()
export class TicketCategoriasService {
  constructor(private prisma: PrismaService) {}

  findAll(q?: string) {
    const where: Record<string, unknown> =
      q && String(q).trim()
        ? { tica_nombre: { contains: String(q).trim(), mode: 'insensitive' } }
        : {};
    return this.prisma.ticket_categorias.findMany({
      where: where as any,
      orderBy: { fecha_sistema: 'desc' },
    });
  }

  async findAllPaged(page = 1, perPage = 10, q?: string) {
    const p = Number(page) > 0 ? Number(page) : 1;
    const pp = Number(perPage) > 0 ? Math.min(Number(perPage), 100) : 10;
    const where: Record<string, unknown> =
      q && String(q).trim()
        ? { tica_nombre: { contains: String(q).trim(), mode: 'insensitive' } }
        : {};
    const [total, data] = await Promise.all([
      this.prisma.ticket_categorias.count({ where: where as any }),
      this.prisma.ticket_categorias.findMany({
        where: where as any,
        skip: (p - 1) * pp,
        take: pp,
        orderBy: { fecha_sistema: 'desc' },
      }),
    ]);
    return {
      data,
      meta: { total, page: p, perPage: pp, totalPages: Math.ceil(total / pp) },
    };
  }

  async findOne(tica_id: number) {
    const p = await this.prisma.ticket_categorias.findUnique({
      where: { tica_id },
    });
    if (!p) throw new NotFoundException('Categoría no encontrada');
    return p;
  }

  create(dto: CreateCategoriaDto) {
    return this.prisma.ticket_categorias.create({
      data: {
        tica_nombre: dto.tica_nombre,
        tica_estado: dto.tica_estado ?? 'A',
      },
    });
  }

  update(tica_id: number, dto: UpdateCategoriaDto) {
    return this.prisma.ticket_categorias.update({
      where: { tica_id },
      data: dto,
    });
  }

  remove(tica_id: number) {
    return this.prisma.ticket_categorias.delete({ where: { tica_id } });
  }
}
