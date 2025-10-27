import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIdentifierDto } from './dto/create-identifier.dto';

@Injectable()
export class IdentifiersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateIdentifierDto) {
    // ensure name unique (using findFirst in case the DB column is not unique)
    const exists = await this.prisma.ticket_identificador.findFirst({ where: { tiid_nombre: dto.tiid_nombre } });
    if (exists) throw new BadRequestException('Identificador con ese nombre ya existe');

    return this.prisma.ticket_identificador.create({ data: {
      tiid_nombre: dto.tiid_nombre,
      tiid_descripcion: dto.tiid_descripcion,
      tiid_tipo_dato: dto.tiid_tipo_dato,
      tiid_min_lenght: dto.tiid_min_lenght,
      tiid_max_lenght: dto.tiid_max_lenght,
    }});
  }

  async findAll() {
    return this.prisma.ticket_identificador.findMany({ orderBy: { fecha_sistema: 'desc' } });
  }

  async findOne(tiid_id: number) {
    return this.prisma.ticket_identificador.findUnique({ where: { tiid_id: tiid_id } });
  }

  async update(tiid_id: number, dto: any) {
    return this.prisma.ticket_identificador.update({ where: { tiid_id: tiid_id }, data: dto });
  }

  async remove(tiid_id: number) {
    return this.prisma.ticket_identificador.delete({ where: { tiid_id: tiid_id } });
  }
}
