import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateIdentifierDto } from './dto/create-identifier.dto';

@Injectable()
export class IdentifiersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateIdentifierDto) {
    // ensure name unique (using findFirst in case the DB column is not unique)
    // ticket_identificador uses tipr_id column (project id)
    const exists = await this.prisma.ticket_identificador.findFirst({
      where: { tiid_nombre: dto.tiid_nombre, tipr_id: dto.tipr_id },
    });
    if (exists) {
      // return field-specific error so frontend shows it inline
      throw new BadRequestException({
        tiid_nombre: ['Identificador con ese nombre ya existe'],
      });
    }

    return this.prisma.ticket_identificador.create({
      data: {
        tipr_id: dto.tipr_id,
        tiid_nombre: dto.tiid_nombre,
        tiid_descripcion: dto.tiid_descripcion,
        tiid_tipo_dato: dto.tiid_tipo_dato,
        tiid_min_lenght: dto.tiid_min_lenght,
        tiid_max_lenght: dto.tiid_max_lenght,
        tiid_solo_letras: dto.tiid_solo_letras ?? false,
        tiid_alpha_numeric: dto.tiid_alpha_numeric ?? false,
        tiid_regex: dto.tiid_regex ?? null,
      },
    });
  }

  async findAll(q?: string) {
    return this.prisma.ticket_identificador.findMany({
      where:
        q && String(q).trim()
          ? ({
              tiid_nombre: { contains: String(q).trim() },
            } as Prisma.ticket_identificadorWhereInput)
          : ({} as Prisma.ticket_identificadorWhereInput),
      orderBy: { fecha_sistema: 'desc' },
    });
  }

  async findAllPaged(page = 1, perPage = 10, q?: string) {
    const p = Number(page) > 0 ? Number(page) : 1;
    const pp = Number(perPage) > 0 ? Math.min(Number(perPage), 100) : 10;
    const where: Prisma.ticket_identificadorWhereInput =
      q && String(q).trim()
        ? { tiid_nombre: { contains: String(q).trim() } }
        : {};
    const [total, data] = await Promise.all([
      this.prisma.ticket_identificador.count({ where }),
      this.prisma.ticket_identificador.findMany({
        where,
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

  async findOne(tiid_id: number) {
    return this.prisma.ticket_identificador.findUnique({
      where: { tiid_id: tiid_id },
    });
  }

  async update(tiid_id: number, dto: Partial<CreateIdentifierDto>) {
    return this.prisma.ticket_identificador.update({
      where: { tiid_id: tiid_id },
      data: dto as Prisma.ticket_identificadorUpdateInput,
    });
  }

  async remove(tiid_id: number) {
    return this.prisma.ticket_identificador.delete({
      where: { tiid_id: tiid_id },
    });
  }
}
