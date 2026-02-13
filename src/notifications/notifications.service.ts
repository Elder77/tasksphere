import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private gateway?: NotificationsGateway,
  ) {}

  async createNotification(data: {
    tick_id?: number;
    tino_tipo: string;
    tino_mensaje: string;
    usua_cedula?: string;
    tick_usuario_asignado?: string;
  }) {
    const createData: Record<string, unknown> = {
      tino_tipo: data.tino_tipo,
      tino_mensaje: data.tino_mensaje,
      tino_estado: 'E',
      fecha_sistema: new Date(),
    };

    if (typeof data.tick_id !== 'undefined' && data.tick_id !== null)
      createData.tick_id = data.tick_id;
    if (data.usua_cedula) createData.usua_cedula = String(data.usua_cedula);
    if (data.tick_usuario_asignado)
      createData.tick_usuario_asignado = String(data.tick_usuario_asignado);

    const rec = (await this.prisma.ticket_notificaciones.create({
      data: createData as any,
    })) as Record<string, unknown>;

    // emit real-time notification to connected sockets if gateway available
    try {
      if (this.gateway) {
        const r = rec;
        const tipo =
          typeof r.tino_tipo === 'string'
            ? r.tino_tipo
            : String(r.tino_tipo ?? '');
        const mensaje =
          typeof r.tino_mensaje === 'string'
            ? r.tino_mensaje
            : String(r.tino_mensaje ?? '');
        if (typeof r.usua_cedula === 'string')
          this.gateway.emitToUser(String(r.usua_cedula), {
            type: String(tipo),
            message: String(mensaje),
            tick_id: r.tick_id,
            id: r.tino_id,
          });
        if (typeof r.tick_usuario_asignado === 'string')
          this.gateway.emitToUser(String(r.tick_usuario_asignado), {
            type: String(tipo),
            message: String(mensaje),
            tick_id: r.tick_id,
            id: r.tino_id,
          });
      }
    } catch (e) {
      // don't fail creation if realtime emit fails
      console.warn('Failed to emit realtime notification', e);
    }

    return rec;
  }

  async findForUserPaged(usua_cedula: string, page = 1, perPage = 10) {
    const p = Number(page) > 0 ? Number(page) : 1;
    const pp = Number(perPage) > 0 ? Math.min(Number(perPage), 100) : 10;
    const where = {
      OR: [
        { usua_cedula: String(usua_cedula) },
        { tick_usuario_asignado: String(usua_cedula) },
      ],
    };
    const [total, data] = await Promise.all([
      this.prisma.ticket_notificaciones.count({ where: where as any }),
      this.prisma.ticket_notificaciones.findMany({
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

  async countUnread(usua_cedula: string) {
    const where = {
      AND: [
        { tino_estado: 'E' },
        {
          OR: [
            { usua_cedula: String(usua_cedula) },
            { tick_usuario_asignado: String(usua_cedula) },
          ],
        },
      ],
    };
    const cnt = await this.prisma.ticket_notificaciones.count({
      where: where as any,
    });
    return cnt;
  }

  async markAsRead(ids: number[] | number, usua_cedula: string) {
    const idsArr = Array.isArray(ids) ? ids : [ids];
    // only update notifications that belong to the user (either as creator or assigned)
    const res = await this.prisma.ticket_notificaciones.updateMany({
      where: {
        tino_id: { in: idsArr },
        AND: [
          {
            OR: [
              { usua_cedula: String(usua_cedula) },
              { tick_usuario_asignado: String(usua_cedula) },
            ],
          },
        ],
      },
      data: { tino_estado: 'L', tino_fecha_actualizacion: new Date() },
    });
    return res;
  }

  async markAllRead(usua_cedula: string) {
    const res = await this.prisma.ticket_notificaciones.updateMany({
      where: {
        AND: [
          {
            OR: [
              { usua_cedula: String(usua_cedula) },
              { tick_usuario_asignado: String(usua_cedula) },
            ],
          },
          { tino_estado: 'E' },
        ],
      },
      data: { tino_estado: 'L', tino_fecha_actualizacion: new Date() },
    });
    return res;
  }
}
