import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { join, extname } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

export interface AuthUser { usua_cedula?: string; perf_id?: number; tipr_id?: number }

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
  constructor(private prisma: PrismaService, private notificationsService?: NotificationsService) {}

  private validateIdentifierValue(identifier: any, value: any) {
    if (value === null || value === undefined) return; // nada que validar aquí
    const v = String(value);
    const tipo = (identifier?.tiid_tipo_dato || 'string').toLowerCase();

    // validaciones de longitud (si están provistas)
  const minL = identifier?.tiid_min_lenght;
  const maxL = identifier?.tiid_max_lenght;
  // tratar null/undefined/0 como "no establecido"
  if (minL != null && Number(minL) > 0 && v.length < Number(minL)) throw new BadRequestException(`Valor muy corto (min ${minL})`);
  if (maxL != null && Number(maxL) > 0 && v.length > Number(maxL)) throw new BadRequestException(`Valor muy largo (max ${maxL})`);

    // type-specific checks
    if (tipo === 'string') {
      if (identifier?.tiid_solo_letras) {
        if (!/^[A-Za-z\s]+$/.test(v)) throw new BadRequestException('Solo se permiten letras en este identificador');
      } else if (identifier?.tiid_alpha_numeric) {
        if (!/^[A-Za-z0-9\s]+$/.test(v)) throw new BadRequestException('Sólo se permiten letras y números en este identificador');
      }
      if (identifier?.tiid_regex) {
        try {
          const re = new RegExp(identifier.tiid_regex);
          if (!re.test(v)) throw new BadRequestException('Valor no cumple la expresión regular del identificador');
        } catch (e) {
          // regex inválida en la BD -> ignorar o lanzar según la política
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

  /**
   * Añade archivos a un ticket existente (upload separada).
   * Devuelve los metadatos guardados (filename, originalName, path, mime, size)
   */
  async addFilesToTicket(id: number, files: Express.Multer.File[], authUser?: AuthUser) {
    const ticket = await this.prisma.ticket.findUnique({ where: { tick_id: id } });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    if (!files || !files.length) return [];
    const saved = this.saveFilesToDisk(id, files, authUser?.usua_cedula ?? '0');
    const created: any[] = [];
    for (const s of saved) {
      const rec = await this.prisma.ticked_file.create({ data: {
        tick_id: id,
        tifi_filename: s.filename,
        tifi_url: s.path,
        tifi_mime: s.mime,
        tifi_size: s.size,
        fecha_sistema: new Date(),
      }});
      created.push(rec);
    }
    await this.prisma.ticket_historial.create({ data: { tick_id: id, tihi_accion: 'FILES_ADDED', usua_cedula: String(authUser?.usua_cedula ?? '0'), fecha_sistema: new Date() } });
    return created;
  }

  async findAll(query: any, authUser?: AuthUser) {
    // paginación
    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const perPage = Number(query.perPage) > 0 ? Math.min(Number(query.perPage), 100) : 10;

  const where: any = {};
    // mapear parámetros de consulta a nombres de columnas en la BD
    if (query.status) where.tick_estado = query.status;
    if (query.module) where.tick_modulo = query.module;
    if (query.search) {
      where.OR = [
        { tick_nombre: { contains: String(query.search), mode: 'insensitive' } },
        { tick_descripcion: { contains: String(query.search), mode: 'insensitive' } },
      ];
    }

    // Si el solicitante está acotado por proyecto (token de proyecto) o es un usuario no-admin con tipr_id, restringir a ese tipr_id
    if (authUser?.tipr_id && authUser?.perf_id !== 2) {
      // authUser.tipr_id se mantiene por compatibilidad, pero contiene el valor tipr_id
      where.tipr_id = Number(authUser.tipr_id);
    }

    // Si el solicitante pidió solo sus tickets (mine=true o mine=1)
    if (query && (query.mine === '1' || query.mine === 'true') && authUser?.usua_cedula) {
      where.usua_cedula = String(authUser.usua_cedula);
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
    // también incluir el nombre del identificador para conveniencia (tiid_nombre)
    const identifier = await this.prisma.ticket_identificador.findUnique({ where: { tiid_id: ticket.tick_id_identificador } });
    const tiid_nombre = identifier?.tiid_nombre ?? null;
    return { ...ticket, files, history, tiid_nombre };
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

    // validar tick_nombre según las reglas del identificador
    const ticketName = createDto.tick_nombre ?? createDto.title ?? null;
    this.validateIdentifierValue(identifier, ticketName);

    const ticket = await this.prisma.ticket.create({ data: {
      tick_nombre: createDto.tick_nombre ?? createDto.title ?? null,
      tick_descripcion: createDto.tick_descripcion ?? createDto.description ?? null,
      tick_id_identificador: tiid_id,
      tick_modulo: createDto.tick_modulo ?? createDto.module ?? null,
      usua_cedula: String(authUser?.usua_cedula ?? createDto.usua_cedula ?? '0'),
      // Si authUser proporciona tipr_id (se mantiene por compatibilidad) preferirlo; almacenar en la columna tipr_id
      tipr_id: Number(authUser?.tipr_id ?? createDto.tipr_id ?? 1),
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

  await this.prisma.ticket_historial.create({ data: { tick_id: ticket.tick_id, tihi_accion: 'CREADO', usua_cedula: String(authUser?.usua_cedula ?? '0'), fecha_sistema: new Date() } });

    return ticket;
  }

  async update(id: number, updateDto: any, files: Express.Multer.File[], authUser?: AuthUser) {
    const ticket = await this.prisma.ticket.findUnique({ where: { tick_id: id } });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');

    // si se está actualizando el nombre, validarlo contra las reglas del identificador
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

  async assign(id: number, assignedToId: number | string, tica_id?: number | null, prio_id?: number | null, authUser?: AuthUser) {
  if (authUser?.perf_id !== 2) throw new ForbiddenException('Solo admin (perf_id=2) puede asignar');
    // verificar que el usuario asignado exista y sea administrador (perf_id === 2)
  const assignedUser = await this.prisma.ticket_usuarios.findUnique({ where: { usua_cedula: String(assignedToId) } });
    if (!assignedUser) throw new NotFoundException('Usuario asignado no existe');
    if (Number(assignedUser.perf_id) !== 2) throw new BadRequestException('El usuario asignado debe ser un administrador (perf_id=2)');

    const updateData: any = { tick_usuario_asignado: String(assignedToId) };
    if (tica_id != null) updateData.tica_id = Number(tica_id);
    if (prio_id != null) updateData.prio_id = Number(prio_id);
    const ticket = await this.prisma.ticket.update({ where: { tick_id: id }, data: updateData });
    // registrar detalles del usuario asignado (cédula - nombres) en tihi_observacion para trazabilidad
    const assignedLabel = `${assignedUser.usua_cedula}${assignedUser.usua_nombres ? ' - ' + assignedUser.usua_nombres : ''}`;
    await this.prisma.ticket_historial.create({ data: { tick_id: id, tihi_accion: 'ASIGNADO', tihi_observacion: assignedLabel, usua_cedula: String(authUser?.usua_cedula ?? '0'), fecha_sistema: new Date() } });
    // crear una notificación para el usuario asignado
    try {
  const message = `Se te asignó el ticket #${ticket.tick_id}${ticket.tick_nombre ? `: ${ticket.tick_nombre}` : ''}`;
  if (this.notificationsService) await this.notificationsService.createNotification({ tick_id: ticket.tick_id, tino_tipo: 'T', tino_mensaje: message, tick_usuario_asignado: String(assignedUser.usua_cedula) });
    } catch (e) {
      // no fallar la asignación si no se puede crear la notificación
      console.warn('Failed to create notification for assignment', e);
    }
    return ticket;
  }

  async close(id: number, note: string, files: Express.Multer.File[], authUser?: AuthUser) {
  if (authUser?.perf_id !== 2) throw new ForbiddenException('Solo admin (perf_id=2) puede cerrar');
    // asegurar que el ticket esté asignado antes de cerrarlo
    const ticket = await this.prisma.ticket.findUnique({ where: { tick_id: id } });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    if (!ticket.tick_usuario_asignado) throw new BadRequestException('El ticket debe estar asignado antes de cerrarlo');

    const updated = await this.prisma.ticket.update({ where: { tick_id: id }, data: { tick_estado: 'C' } });

  let savedFiles: any[] = [];
    if (files && files.length) {
      savedFiles = this.saveFilesToDisk(id, files, authUser?.usua_cedula ?? '0');
      for (const s of savedFiles) {
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
    // registrar historial; si se guardaron archivos, incluir la ruta del primer archivo en tihi_url_file
  const firstFilePath = savedFiles.length ? `/tickets/${id}/files/${encodeURIComponent(String(savedFiles[0].filename))}` : null;
  await this.prisma.ticket_historial.create({ data: { tick_id: id, tihi_accion: 'CERRADO', tihi_observacion: note ?? null, tihi_url_file: firstFilePath ?? null, usua_cedula: String(authUser?.usua_cedula ?? '0'), fecha_sistema: new Date() } });
    return updated;
  }

  async reopen(id: number, reason: string, files: Express.Multer.File[], authUser?: AuthUser) {
    const ticket = await this.prisma.ticket.findUnique({ where: { tick_id: id } });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
  if (ticket.usua_cedula !== String(authUser?.usua_cedula ?? '')) throw new ForbiddenException('Solo el creador puede reabrir');

    const updated = await this.prisma.ticket.update({ where: { tick_id: id }, data: { tick_estado: 'P' } });

  let savedFiles: any[] = [];
    if (files && files.length) {
      savedFiles = this.saveFilesToDisk(id, files, authUser?.usua_cedula ?? '0');
      for (const s of savedFiles) {
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
  const firstFilePath = savedFiles.length ? `/tickets/${id}/files/${encodeURIComponent(String(savedFiles[0].filename))}` : null;
  await this.prisma.ticket_historial.create({ data: { tick_id: id, tihi_accion: 'REABIERTO', tihi_observacion: reason ?? null, tihi_url_file: firstFilePath ?? null, usua_cedula: String(authUser?.usua_cedula ?? '0'), fecha_sistema: new Date() } });
    return updated;
  }

  /**
   * Devuelve el historial (ticket_historial) de un ticket
   */
  async getHistory(tick_id: number) {
    const ticket = await this.prisma.ticket.findUnique({ where: { tick_id } });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    return this.prisma.ticket_historial.findMany({ where: { tick_id }, orderBy: { fecha_sistema: 'asc' } });
  }

  // Persistir mensajes de chat provenientes del gateway
  async persistChatMessage(tick_id: number, usua_cedula: number | string, tich_mensaje?: string, tich_file_url?: string) {
    // Asegurar que el ticket exista para devolver errores claros al gateway
    const ticket = await this.prisma.ticket.findUnique({ where: { tick_id: tick_id } });
    if (!ticket) {
      // Lanzar NotFoundException estándar para que los llamadores puedan manejarlo
      throw new NotFoundException('Ticket no encontrado');
    }
    const rec = await this.prisma.ticket_chat.create({ data: { tick_id, usua_cedula: String(usua_cedula), tich_mensaje: tich_mensaje ?? '', tich_file_url: tich_file_url ?? null, fecha_sistema: new Date() } });
    // La creación de notificaciones por mensajes de chat la gestiona ChatGateway
    // (el gateway puede determinar qué sockets están presentes en la sala y si
    // notificar al usuario asignado o al creador del ticket). Mantener sólo la persistencia aquí.
    return rec;
  }

  /**
   * Devuelve el historial de mensajes de un ticket ordenado por fecha ascendente.
   */
  async getChatMessages(tick_id: number) {
    // Asegurar que el ticket exista
    const ticket = await this.prisma.ticket.findUnique({ where: { tick_id: tick_id } });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    return this.prisma.ticket_chat.findMany({ where: { tick_id }, orderBy: { fecha_sistema: 'asc' } });
  }

  // Buscar un proyecto por su token (usado para aceptar tokens a nivel de proyecto)
  async findProjectByToken(token: string) {
    if (!token) return null;
    // el nuevo nombre de modelo es ticket_proyectos con el campo tipr_token
    return this.prisma.ticket_proyectos.findFirst({ where: { tipr_token: token } });
  }
}
