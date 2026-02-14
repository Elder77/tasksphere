import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { Prisma } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private gateway?: NotificationsGateway,
  ) {}

  private isRecord(x: unknown): x is Record<string, unknown> {
    return typeof x === 'object' && x !== null;
  }

  async createNotification(data: {
    tick_id: number;
    tino_tipo: string;
    tino_mensaje: string;
    usua_cedula?: string;
    tick_usuario_asignado?: string;
  }) {
    const createData: Prisma.ticket_notificacionesCreateInput = {
      tick_id: data.tick_id,
      tino_tipo: data.tino_tipo,
      tino_mensaje: data.tino_mensaje,
      tino_estado: 'E',
      fecha_sistema: new Date(),
    };
    if (data.usua_cedula) createData.usua_cedula = String(data.usua_cedula);
    if (data.tick_usuario_asignado)
      createData.tick_usuario_asignado = String(data.tick_usuario_asignado);

    const rec = await this.prisma.ticket_notificaciones.create({
      data: createData,
    });

    // emit real-time notification to connected sockets if gateway available
    try {
      if (this.gateway) {
        const tipo = String(rec.tino_tipo ?? '');
        const mensaje = String(rec.tino_mensaje ?? '');
        const tickIdVal = rec.tick_id;
        const notifId = rec.tino_id;
        if (typeof rec.usua_cedula === 'string')
          this.gateway.emitToUser(String(rec.usua_cedula), {
            type: String(tipo),
            message: String(mensaje),
            tick_id: tickIdVal,
            id: notifId,
          });
        if (typeof rec.tick_usuario_asignado === 'string')
          this.gateway.emitToUser(String(rec.tick_usuario_asignado), {
            type: String(tipo),
            message: String(mensaje),
            tick_id: tickIdVal,
            id: notifId,
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
    const where: Prisma.ticket_notificacionesWhereInput = {
      OR: [
        { usua_cedula: String(usua_cedula) },
        { tick_usuario_asignado: String(usua_cedula) },
      ],
    };
    const [total, data] = await Promise.all([
      this.prisma.ticket_notificaciones.count({ where }),
      this.prisma.ticket_notificaciones.findMany({
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

  async countUnread(usua_cedula: string) {
    const where: Prisma.ticket_notificacionesWhereInput = {
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
    const cnt = await this.prisma.ticket_notificaciones.count({ where });
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
