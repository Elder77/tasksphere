import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { join, extname } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

export interface AuthUser { id: number; role?: string }

const ALLOWED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any) {
    // pagination
    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const perPage = Number(query.perPage) > 0 ? Math.min(Number(query.perPage), 100) : 10;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.module) where.module = query.module;
    if (query.search) {
      where.OR = [
        { title: { contains: String(query.search), mode: 'insensitive' } },
        { description: { contains: String(query.search), mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({ where, skip: (page - 1) * perPage, take: perPage, orderBy: { createdAt: 'desc' } }),
    ]);

    return { data, meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) } };
  }

  async findOne(id: number) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');

    const files = await this.prisma.ticketFile.findMany({ where: { ticketId: id } });
    const history = await this.prisma.ticketHistory.findMany({ where: { ticketId: id }, orderBy: { createdAt: 'asc' } });
    return { ...ticket, files, history };
  }

  private saveFilesToDisk(ticketId: number, files: Express.Multer.File[], uploadedBy: number) {
    const base = join(process.cwd(), 'uploads', 'tickets', String(ticketId));
    if (!existsSync(base)) mkdirSync(base, { recursive: true });

    const saved: Array<{ filename: string; originalName: string; path: string; mime: string; size: number; uploadedBy: number }> = [];
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) throw new BadRequestException(`El archivo ${f.originalname} supera el tamaño máximo de 5MB`);
      if (!ALLOWED_MIMES.has(f.mimetype)) throw new BadRequestException(`Tipo de archivo no permitido: ${f.mimetype}`);

      const id = uuidv4();
      const ext = extname(f.originalname) || '';
      const filename = `${id}${ext}`;
      const path = join(base, filename);
      writeFileSync(path, f.buffer || Buffer.from(''));
      saved.push({ filename, originalName: f.originalname, path, mime: f.mimetype, size: f.size, uploadedBy });
    }
    return saved;
  }

  async create(createDto: any, files: Express.Multer.File[], authUser?: AuthUser) {
    const identifierId = Number(createDto.identifierId);
    if (isNaN(identifierId)) throw new BadRequestException('identifierId inválido');

    const identifier = await this.prisma.identifier.findUnique({ where: { id: identifierId } });
    if (!identifier) throw new BadRequestException('Identificador no existe');

    const ticket = await this.prisma.ticket.create({ data: {
      title: createDto.title,
      description: createDto.description,
      identifierId: identifierId,
      module: createDto.module,
      userId: authUser?.id || Number(createDto.userId) || 0,
    }});

    if (files && files.length) {
      const saved = this.saveFilesToDisk(ticket.id, files, authUser?.id || 0);
      for (const s of saved) {
        await this.prisma.ticketFile.create({ data: {
          ticketId: ticket.id,
          filename: s.filename,
          path: s.path,
          mime: s.mime,
          size: s.size,
          uploadedBy: s.uploadedBy,
        }});
      }
    }

    await this.prisma.ticketHistory.create({ data: { ticketId: ticket.id, action: 'CREATED', userId: authUser?.id || 0, note: '' } });

    return ticket;
  }

  async update(id: number, updateDto: any, files: Express.Multer.File[], authUser?: AuthUser) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');

    const updated = await this.prisma.ticket.update({ where: { id }, data: { description: updateDto.description ?? ticket.description, module: updateDto.module ?? ticket.module } });

    if (files && files.length) {
      const saved = this.saveFilesToDisk(id, files, authUser?.id || 0);
      for (const s of saved) {
        await this.prisma.ticketFile.create({ data: {
          ticketId: id,
          filename: s.filename,
          path: s.path,
          mime: s.mime,
          size: s.size,
          uploadedBy: s.uploadedBy,
        }});
      }
    }

    await this.prisma.ticketHistory.create({ data: { ticketId: id, action: 'EDITED', userId: authUser?.id || 0, note: updateDto.description || '' } });

    return updated;
  }

  async assign(id: number, assignedToId: number, authUser?: AuthUser) {
    if (authUser?.role !== 'superadmin') throw new ForbiddenException('Solo superadmin puede asignar');
    const ticket = await this.prisma.ticket.update({ where: { id }, data: { assignedTo: assignedToId } });
    await this.prisma.ticketHistory.create({ data: { ticketId: id, action: 'ASSIGNED', userId: authUser?.id || 0, note: String(assignedToId) } });
    return ticket;
  }

  async close(id: number, note: string, files: Express.Multer.File[], authUser?: AuthUser) {
    if (authUser?.role !== 'superadmin') throw new ForbiddenException('Solo superadmin puede cerrar');
    const ticket = await this.prisma.ticket.update({ where: { id }, data: { status: 'closed' } });

    if (files && files.length) {
      const saved = this.saveFilesToDisk(id, files, authUser?.id || 0);
      for (const s of saved) {
        await this.prisma.ticketFile.create({ data: {
          ticketId: id,
          filename: s.filename,
          path: s.path,
          mime: s.mime,
          size: s.size,
          uploadedBy: s.uploadedBy,
        }});
      }
    }
    await this.prisma.ticketHistory.create({ data: { ticketId: id, action: 'CLOSED', userId: authUser?.id || 0, note } });
    return ticket;
  }

  async reopen(id: number, reason: string, files: Express.Multer.File[], authUser?: AuthUser) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    if (ticket.userId !== (authUser?.id || 0)) throw new ForbiddenException('Solo el creador puede reabrir');

    const updated = await this.prisma.ticket.update({ where: { id }, data: { status: 'reopened' } });

    if (files && files.length) {
      const saved = this.saveFilesToDisk(id, files, authUser?.id || 0);
      for (const s of saved) {
        await this.prisma.ticketFile.create({ data: {
          ticketId: id,
          filename: s.filename,
          path: s.path,
          mime: s.mime,
          size: s.size,
          uploadedBy: s.uploadedBy,
        }});
      }
    }

    await this.prisma.ticketHistory.create({ data: { ticketId: id, action: 'REOPENED', userId: authUser?.id || 0, note: reason } });
    return updated;
  }

  // Persist chat messages coming from the gateway
  async persistChatMessage(ticketId: number, senderId: number, message?: string, fileUrl?: string) {
    // Ensure ticket exists to provide clearer errors to the gateway
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      // Throw a standard NotFoundException so callers can handle it
      throw new NotFoundException('Ticket no encontrado');
    }
    return this.prisma.chatMessage.create({ data: { ticketId, senderId, message: message ?? '', fileUrl: fileUrl ?? null } });
  }
}
