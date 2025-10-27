import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { join, extname } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

export interface AuthUser { usua_cedula?: string; perf_id?: number; proy_id?: number }

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

  private validateIdentifierValue(identifier: any, value: any) {
    if (value === null || value === undefined) return; // nothing to validate here
    const v = String(value);
    const tipo = (identifier?.tiid_tipo_dato || 'string').toLowerCase();

    // helper length checks (if provided)
  const minL = identifier?.tiid_min_lenght;
  const maxL = identifier?.tiid_max_lenght;
  // treat null/undefined/0 as "not set"
  if (minL != null && Number(minL) > 0 && v.length < Number(minL)) throw new BadRequestException(`Valor muy corto (min ${minL})`);
  if (maxL != null && Number(maxL) > 0 && v.length > Number(maxL)) throw new BadRequestException(`Valor muy largo (max ${maxL})`);

    // type-specific checks
    if (tipo === 'string') {
      if (identifier?.tiid_solo_letres) {
        if (!/^[A-Za-z\s]+$/.test(v)) throw new BadRequestException('Solo se permiten letras en este identificador');
      } else if (identifier?.tiid_alpha_numeric) {
        if (!/^[A-Za-z0-9\s]+$/.test(v)) throw new BadRequestException('Sólo se permiten letras y números en este identificador');
      }
      if (identifier?.tiid_regex) {
        try {
          const re = new RegExp(identifier.tiid_regex);
          if (!re.test(v)) throw new BadRequestException('Valor no cumple la expresión regular del identificador');
        } catch (e) {
          // invalid regex in database -> ignore or throw depending on policy
          throw new BadRequestException('Expresión regular del identificador inválida');
        }
      }
    } else if (tipo === 'numero' || tipo === 'number' || tipo === 'entero' || tipo === 'integer') {
      if (!/^-?\d+$/.test(v)) throw new BadRequestException('Valor debe ser un número entero para este identificador');
    } else if (tipo === 'decimal' || tipo === 'float' || tipo === 'double') {
      if (!/^-?\d+(\.\d+)?$/.test(v)) throw new BadRequestException('Valor debe ser un número decimal para este identificador');
    } else if (tipo === 'fecha' || tipo === 'date') {
      const d = Date.parse(v);
      if (isNaN(d)) throw new BadRequestException('Valor debe ser una fecha válida para este identificador');
    } else if (tipo === 'booleano' || tipo === 'boolean') {
      if (!/^(true|false|0|1)$/.test(v.toLowerCase())) throw new BadRequestException('Valor debe ser booleano (true/false)');
    }
  }

  async findAll(query: any, authUser?: AuthUser) {
    // pagination
    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const perPage = Number(query.perPage) > 0 ? Math.min(Number(query.perPage), 100) : 10;

  const where: any = {};
    // map query params to DB column names
    if (query.status) where.tick_estado = query.status;
    if (query.module) where.tick_modulo = query.module;
    if (query.search) {
      where.OR = [
        { tick_nombre: { contains: String(query.search), mode: 'insensitive' } },
        { tick_descripcion: { contains: String(query.search), mode: 'insensitive' } },
      ];
    }

    // If caller is project-scoped (project token) or a non-admin user with proy_id, restrict to that proy_id
    if (authUser?.proy_id && authUser?.perf_id !== 2) {
      where.proy_id = Number(authUser.proy_id);
    }

    const [total, data] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({ where, skip: (page - 1) * perPage, take: perPage, orderBy: { fecha_sistema: 'desc' } }),
    ]);

    return { data, meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) } };
  }

  async findOne(id: number) {
    const ticket = await this.prisma.ticket.findUnique({ where: { tick_id: id } });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');

    const files = await this.prisma.ticked_file.findMany({ where: { tick_id: id } });
    const history = await this.prisma.ticket_historial.findMany({ where: { tick_id: id }, orderBy: { fecha_sistema: 'asc' } });
    return { ...ticket, files, history };
  }

  private saveFilesToDisk(tick_id: number, files: Express.Multer.File[], uploadedBy: number | string) {
    const base = join(process.cwd(), 'uploads', 'tickets', String(tick_id));
    if (!existsSync(base)) mkdirSync(base, { recursive: true });

    const saved: Array<{ filename: string; originalName: string; path: string; mime: string; size: number; uploadedBy: number | string }> = [];
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) throw new BadRequestException(`El archivo ${f.originalname} supera el tamaño máximo de 5MB`);
      if (!ALLOWED_MIMES.has(f.mimetype)) throw new BadRequestException(`Tipo de archivo no permitido: ${f.mimetype}`);

  const id = randomUUID();
      const ext = extname(f.originalname) || '';
      const filename = `${id}${ext}`;
      const path = join(base, filename);
      writeFileSync(path, f.buffer || Buffer.from(''));
      saved.push({ filename, originalName: f.originalname, path, mime: f.mimetype, size: f.size, uploadedBy });
    }
    return saved;
  }

  async create(createDto: any, files: Express.Multer.File[], authUser?: AuthUser) {
  const tiid_id = Number(createDto.tiid_id);
    if (isNaN(tiid_id)) throw new BadRequestException('tiid_id inválido');

    const identifier = await this.prisma.ticket_identificador.findUnique({ where: { tiid_id: tiid_id } });
    if (!identifier) throw new BadRequestException('Identificador no existe');

    // validate tick_nombre according to identifier rules
    const ticketName = createDto.tick_nombre ?? createDto.title ?? null;
    this.validateIdentifierValue(identifier, ticketName);

    const ticket = await this.prisma.ticket.create({ data: {
      tick_nombre: createDto.tick_nombre ?? createDto.title ?? null,
      tick_descripcion: createDto.tick_descripcion ?? createDto.description ?? null,
      tick_id_identificador: tiid_id,
      tick_modulo: createDto.tick_modulo ?? createDto.module ?? null,
      usua_cedula: String(authUser?.usua_cedula ?? createDto.usua_cedula ?? '0'),
      // If authUser provides proy_id (either from JWT or from project token), prefer it. Otherwise fallback to provided createDto or 1
      proy_id: Number(authUser?.proy_id ?? createDto.proy_id ?? 1),
    }});

    if (files && files.length) {
      const saved = this.saveFilesToDisk(ticket.tick_id, files, authUser?.usua_cedula ?? '0');
      for (const s of saved) {
        await this.prisma.ticked_file.create({ data: {
          tick_id: ticket.tick_id,
          tifi_filename: s.filename,
          tifi_url: s.path,
          tifi_mime: s.mime,
          tifi_size: s.size,
          fecha_sistema: new Date(),
        }});
      }
    }

  await this.prisma.ticket_historial.create({ data: { tick_id: ticket.tick_id, tihi_accion: 'CREATED', usua_cedula: String(authUser?.usua_cedula ?? '0'), fecha_sistema: new Date() } });

    return ticket;
  }

  async update(id: number, updateDto: any, files: Express.Multer.File[], authUser?: AuthUser) {
    const ticket = await this.prisma.ticket.findUnique({ where: { tick_id: id } });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');

    // if the name is being updated, validate it against the identifier rules
    if (updateDto.tick_nombre) {
      const identifier = await this.prisma.ticket_identificador.findUnique({ where: { tiid_id: ticket.tick_id_identificador } });
      if (identifier) this.validateIdentifierValue(identifier, updateDto.tick_nombre);
    }

    const updated = await this.prisma.ticket.update({ where: { tick_id: id }, data: { tick_descripcion: updateDto.tick_descripcion ?? updateDto.description ?? ticket.tick_descripcion, tick_modulo: updateDto.tick_modulo ?? updateDto.module ?? ticket.tick_modulo } });

    if (files && files.length) {
      const saved = this.saveFilesToDisk(id, files, authUser?.usua_cedula ?? '0');
      for (const s of saved) {
        await this.prisma.ticked_file.create({ data: {
          tick_id: id,
          tifi_filename: s.filename,
          tifi_url: s.path,
          tifi_mime: s.mime,
          tifi_size: s.size,
          fecha_sistema: new Date(),
        }});
      }
    }

  await this.prisma.ticket_historial.create({ data: { tick_id: id, tihi_accion: 'EDITED', usua_cedula: String(authUser?.usua_cedula ?? '0'), fecha_sistema: new Date() } });

    return updated;
  }

  async assign(id: number, assignedToId: number | string, authUser?: AuthUser) {
  if (authUser?.perf_id !== 2) throw new ForbiddenException('Solo admin (perf_id=2) puede asignar');
    // verify assigned user exists and is admin (perf_id === 2)
  const assignedUser = await this.prisma.ticket_usuarios.findUnique({ where: { usua_cedula: String(assignedToId) } });
    if (!assignedUser) throw new NotFoundException('Usuario asignado no existe');
    if (Number(assignedUser.perf_id) !== 2) throw new BadRequestException('El usuario asignado debe ser un administrador (perf_id=2)');

    const ticket = await this.prisma.ticket.update({ where: { tick_id: id }, data: { tick_usuario_asignado: String(assignedToId) } });
    await this.prisma.ticket_historial.create({ data: { tick_id: id, tihi_accion: 'ASSIGNED', usua_cedula: String(authUser?.usua_cedula ?? '0'), fecha_sistema: new Date() } });
    return ticket;
  }

  async close(id: number, note: string, files: Express.Multer.File[], authUser?: AuthUser) {
  if (authUser?.perf_id !== 2) throw new ForbiddenException('Solo admin (perf_id=2) puede cerrar');
    // ensure ticket is assigned before closing
    const ticket = await this.prisma.ticket.findUnique({ where: { tick_id: id } });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    if (!ticket.tick_usuario_asignado) throw new BadRequestException('El ticket debe estar asignado antes de cerrarlo');

    const updated = await this.prisma.ticket.update({ where: { tick_id: id }, data: { tick_estado: 'C' } });

    if (files && files.length) {
      const saved = this.saveFilesToDisk(id, files, authUser?.usua_cedula ?? '0');
      for (const s of saved) {
        await this.prisma.ticked_file.create({ data: {
          tick_id: id,
          tifi_filename: s.filename,
          tifi_url: s.path,
          tifi_mime: s.mime,
          tifi_size: s.size,
          fecha_sistema: new Date(),
        }});
      }
    }
    await this.prisma.ticket_historial.create({ data: { tick_id: id, tihi_accion: 'CLOSED', usua_cedula: String(authUser?.usua_cedula ?? '0'), fecha_sistema: new Date() } });
    return updated;
  }

  async reopen(id: number, reason: string, files: Express.Multer.File[], authUser?: AuthUser) {
    const ticket = await this.prisma.ticket.findUnique({ where: { tick_id: id } });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
  if (ticket.usua_cedula !== String(authUser?.usua_cedula ?? '')) throw new ForbiddenException('Solo el creador puede reabrir');

    const updated = await this.prisma.ticket.update({ where: { tick_id: id }, data: { tick_estado: 'R' } });

    if (files && files.length) {
      const saved = this.saveFilesToDisk(id, files, authUser?.usua_cedula ?? '0');
      for (const s of saved) {
        await this.prisma.ticked_file.create({ data: {
          tick_id: id,
          tifi_filename: s.filename,
          tifi_url: s.path,
          tifi_mime: s.mime,
          tifi_size: s.size,
          fecha_sistema: new Date(),
        }});
      }
    }

  await this.prisma.ticket_historial.create({ data: { tick_id: id, tihi_accion: 'REOPENED', usua_cedula: String(authUser?.usua_cedula ?? '0'), fecha_sistema: new Date() } });
    return updated;
  }

  // Persist chat messages coming from the gateway
  async persistChatMessage(tick_id: number, usua_cedula: number | string, tich_mensaje?: string, tich_file_url?: string) {
    // Ensure ticket exists to provide clearer errors to the gateway
    const ticket = await this.prisma.ticket.findUnique({ where: { tick_id: tick_id } });
    if (!ticket) {
      // Throw a standard NotFoundException so callers can handle it
      throw new NotFoundException('Ticket no encontrado');
    }
    return this.prisma.ticket_chat.create({ data: { tick_id, usua_cedula: String(usua_cedula), tich_mensaje: tich_mensaje ?? '', tich_file_url: tich_file_url ?? null, fecha_sistema: new Date() } });
  }

  /**
   * Devuelve el historial de mensajes de un ticket ordenado por fecha ascendente.
   */
  async getChatMessages(tick_id: number) {
    // Ensure ticket exists
    const ticket = await this.prisma.ticket.findUnique({ where: { tick_id: tick_id } });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    return this.prisma.ticket_chat.findMany({ where: { tick_id }, orderBy: { fecha_sistema: 'asc' } });
  }

  // Find a project by its token (used to accept project-level tokens)
  async findProjectByToken(token: string) {
    if (!token) return null;
    return this.prisma.proyectos.findFirst({ where: { proy_token: token } });
  }
}
