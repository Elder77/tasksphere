import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayInit } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { Injectable, Logger } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const JWT_SECRET = process.env.JWT_SECRET || 'mi_secreto_super_seguro';

@WebSocketGateway({
  namespace: '/ws/tickets',
  cors: {
    origin: '*', // o el dominio exacto del cliente, ej. 'http://127.0.0.1:5500'
    methods: ['GET', 'POST'],
    credentials: false,
  },
})
@Injectable()
export class ChatGateway implements OnGatewayInit {
  private readonly logger = new Logger(ChatGateway.name);
  private server: Server;
  constructor(private ticketsService: TicketsService, private prisma: PrismaService, private notificationsService?: NotificationsService) {}

  afterInit(server: Server) {
    this.server = server;
    // middleware para autenticar conexiones de socket
    server.use((socket: any, next: any) => {
      (async () => {
        try {
          let token = (socket.handshake.auth && socket.handshake.auth.token) || (socket.handshake.query && socket.handshake.query.token);
          if (!token) return next(new Error('No auth token'));
          if (typeof token === 'string') {
            // eliminar comillas alrededor si existen
            token = token.replace(/^\"|\"$/g, '');
            // eliminar prefijo 'Bearer ' si está presente
            if (token.startsWith('Bearer ')) token = token.slice(7);
          }

          try {
            const payload: any = jwt.verify(token, JWT_SECRET);
            // adjuntar información mínima del usuario en socket.data para handlers posteriores
            socket.data = socket.data || {};
            socket.data.user = {
              usua_cedula: payload.sub,
              usua_email: payload.usua_email ?? payload.email,
              perf_id: payload.perf_id,
              tipr_id: payload.tipr_id,
            };
            return next();
          } catch (e) {
            // si la verificación JWT falló, intentar buscar token de proyecto en la BD
                  const project = await this.prisma.ticket_proyectos.findFirst({ where: { tipr_token: String(token) } });
            if (project) {
              socket.data = socket.data || {};
                    socket.data.user = { tipr_id: project.tipr_id, project_token: true };
              return next();
            }
            this.logger.warn('Socket auth failed: ' + (e && (e as any).message ? (e as any).message : String(e)));
            return next(new Error('Token inválido'));
          }
        } catch (err) {
          this.logger.warn('Socket auth failed: ' + (err && (err as any).message ? (err as any).message : String(err)));
          return next(new Error('Token inválido'));
        }
      })().catch((err) => {
        this.logger.warn('Socket auth unexpected error: ' + String(err));
        return next(new Error('Token inválido'));
      });
    });
  }

  @SubscribeMessage('join_ticket')
  async handleJoin(@MessageBody() payload: any, @ConnectedSocket() client: Socket) {
    // soportar tanto `tick_id` como `ticket_id` según el cliente
    const tickId = Number(payload?.tick_id ?? payload?.ticket_id ?? payload?.id);
    if (!tickId || isNaN(tickId)) return { status: 'error', message: 'tick_id inválido' };
    const room = `ticket_${tickId}`;
    try {
  const ticket = await this.ticketsService.findOne(tickId);
      const user = (client as any).data?.user;
      if (!ticket) return { status: 'error', message: 'Ticket no existe' };
      // El chat sólo está permitido cuando el ticket ha sido asignado
      if (!ticket.tick_usuario_asignado) return { status: 'forbidden', reason: 'ticket_not_assigned' };
      const allowed =
        // administrador (perf_id=2) o creador o usuario asignado
        user?.perf_id === 2 ||
        ticket.usua_cedula === user?.usua_cedula ||
        ticket.tick_usuario_asignado === user?.usua_cedula;
      if (!allowed) return { status: 'forbidden', reason: 'not_allowed' };
      client.join(room);
      // obtener historial de chat e incluirlo en la respuesta de unión
      try {
  const messages = await this.ticketsService.getChatMessages(tickId);
  return { status: 'joined', tick_id: tickId, messages };
      } catch (err) {
        // si no se pueden cargar los mensajes, permitir unión pero informar al cliente
        this.logger.warn('No se pudo cargar el historial de chat para el ticket ' + payload.tick_id + ': ' + (err as any).message);
        return { status: 'joined', tick_id: payload.tick_id, messages: [] };
      }
    } catch (err) {
      this.logger.error('join_ticket error', err as any);
      // Si el servicio lanzó NotFoundException, incluir esa razón; si no, usar mensaje genérico
      const reason = err && (err.message || (err.response && err.response.message)) ? (err.message || err.response.message) : 'internal_error';
      return { status: 'error', reason };
    }
  }

  @SubscribeMessage('message')
  async handleMessage(@MessageBody() payload: any, @ConnectedSocket() client: Socket) {
    const tickId = Number(payload?.tick_id ?? payload?.ticket_id ?? payload?.id);
    if (!tickId || isNaN(tickId)) return { status: 'error', message: 'tick_id inválido' };
    const room = `ticket_${tickId}`;
    const user = (client as any).data?.user;
    try {
      const saved = await this.ticketsService.persistChatMessage(tickId, String(user?.usua_cedula ?? '0'), payload.message, payload.fileUrl);
      // normalizar salida usando nombres de campos de los modelos Prisma
      const out = {
        tich_id: (saved as any).tich_id ?? (saved as any).id,
        tick_id: (saved as any).tick_id,
        usua_cedula: (saved as any).usua_cedula,
        tich_mensaje: (saved as any).tich_mensaje ?? (saved as any).message,
        tich_file_url: (saved as any).tich_file_url ?? (saved as any).fileUrl,
        fecha_sistema: (saved as any).fecha_sistema ?? (saved as any).createdAt,
      };
      client.to(room).emit('message', out);

      // determinar presencia en la sala y crear notificaciones para usuarios que no estén conectados al chat
      try {
        const members = this.server?.sockets?.adapter?.rooms?.get(room) || new Set();
        const isUserInRoom = (cedula: string) => {
          try {
            if (!cedula) return false;
            for (const sid of Array.from(members)) {
              const s = this.server.sockets.sockets.get(sid as any);
              if (!s) continue;
              const sockUser = (s as any).data?.user?.usua_cedula || (s as any).data?.user?.sub;
              if (sockUser && String(sockUser) === String(cedula)) return true;
            }
          } catch (e) {
            // ignorar
          }
          return false;
        };

  const ticketRec = await this.prisma.ticket.findUnique({ where: { tick_id: tickId } });
        const assigned = ticketRec?.tick_usuario_asignado;
        const creator = ticketRec?.usua_cedula;
        const sender = String(user?.usua_cedula ?? '');
        const snippet = (payload.message || '').slice(0, 140);
        const msg = snippet ? `Nuevo mensaje en el ticket #${tickId}: "${snippet}"` : `Nuevo mensaje en el ticket #${tickId}`;

        // notificar al usuario asignado si no está en el chat y no es el remitente
        if (assigned && String(assigned) !== sender && !isUserInRoom(assigned)) {
          try {
            if (this.notificationsService) await this.notificationsService.createNotification({ tick_id: tickId, tino_tipo: 'C', tino_mensaje: msg, tick_usuario_asignado: String(assigned) });
          } catch (e) {
            this.logger.warn('Failed to create assigned-user notification: ' + String(e));
          }
        }

        // notificar al creador del ticket si no está en el chat y no es el remitente
        if (creator && String(creator) !== sender && !isUserInRoom(creator)) {
          try {
            if (this.notificationsService) await this.notificationsService.createNotification({ tick_id: tickId, tino_tipo: 'C', tino_mensaje: msg, usua_cedula: String(creator) });
          } catch (e) {
            this.logger.warn('Failed to create creator notification: ' + String(e));
          }
        }
      } catch (e) {
        this.logger.warn('Error while evaluating/creating chat notifications: ' + String(e));
      }

      return { status: 'ok', message: out };
    } catch (err) {
      this.logger.error('message handler error', err as any);
      const reason = err && (err.message || (err.response && err.response.message)) ? (err.message || err.response.message) : 'internal_error';
      return { status: 'error', reason };
    }
  }
}
