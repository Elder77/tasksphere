import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIdentifierDto } from './dto/create-identifier.dto';

@Injectable()
export class IdentifiersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateIdentifierDto) {
    // ensure name unique
    const exists = await this.prisma.identifier.findUnique({ where: { name: dto.name } });
    if (exists) throw new BadRequestException('Identificador con ese nombre ya existe');

    return this.prisma.identifier.create({ data: {
      name: dto.name,
      description: dto.description,
      dataType: dto.dataType,
      minLength: dto.minLength,
      maxLength: dto.maxLength,
    }});
  }

  async findAll() {
    return this.prisma.identifier.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: number) {
    return this.prisma.identifier.findUnique({ where: { id } });
  }

  async update(id: number, dto: any) {
    return this.prisma.identifier.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    return this.prisma.identifier.delete({ where: { id } });
  }
}
