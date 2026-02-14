import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import type { AuthUser } from '../types/auth';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '../config/config.service';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// JWT secret will be read from ConfigService at runtime

@WebSocketGateway({
  namespace: '/ws/tickets',
  cors: {
    origin: true, // permitir dinámicamente orígenes (ajustar en producción)
    methods: ['GET', 'POST'],
    credentials: false,
  },
})
@Injectable()
export class ChatGateway implements OnGatewayInit {
  private readonly logger = new Logger(ChatGateway.name);
  private server: Server;
  private jwtSecret: string;
  private isAuthUser(x: unknown): x is AuthUser {
    if (typeof x !== 'object' || x === null) return false;
    const r = x as Record<string, unknown>;
    return (
      typeof r['usua_cedula'] !== 'undefined' ||
      typeof r['tipr_id'] !== 'undefined'
    );
  }
  private isRecord(x: unknown): x is Record<string, unknown> {
    return typeof x === 'object' && x !== null;
  }
  private getRoomMembers(room: string): Set<unknown> {
    try {
      const serverUnknown: unknown = this.server as unknown;
      if (!this.isRecord(serverUnknown)) return new Set<unknown>();
      const serverRec = serverUnknown;
      const socketsContainer: unknown =
        serverRec['sockets'] ?? serverRec['adapter'] ?? serverUnknown;

      if (this.isRecord(socketsContainer)) {
        const rooms: unknown = socketsContainer['rooms'];
        if (rooms instanceof Map) {
          const mapRooms = rooms as Map<unknown, unknown>;
          const value: unknown = mapRooms.get(room);
          if (value instanceof Set) return value as Set<unknown>;
        }
        // fallback: maybe rooms is a plain object with arrays
        if (this.isRecord(rooms)) {
          const maybe = rooms[room];
          if (Array.isArray(maybe)) return new Set(maybe);
        }
      }

      return new Set<unknown>();
    } catch {
      return new Set<unknown>();
    }
  }
  constructor(
    private ticketsService: TicketsService,
    private prisma: PrismaService,
    private config: ConfigService,
    @Optional() private notificationsService?: NotificationsService,
  ) {
    this.jwtSecret = this.config.getJwtSecret();
  }

  afterInit(server: Server) {
    this.server = server;
    // middleware para autenticar conexiones de socket
    server.use((socket: Socket, next: (err?: Error) => void) => {
      void (async () => {
        try {
          const hs = socket.handshake as unknown as
            | Record<string, unknown>
            | undefined;
          const authPart = hs ? hs['auth'] : undefined;
          const queryPart = hs ? hs['query'] : undefined;
          let token: string | undefined;

          if (authPart && typeof authPart === 'object' && 'token' in authPart) {
            const t = (authPart as Record<string, unknown>).token;
            if (typeof t === 'string') token = t;
          }
          if (
            !token &&
            queryPart &&
            typeof queryPart === 'object' &&
            'token' in queryPart
          ) {
            const t = (queryPart as Record<string, unknown>).token;
            if (typeof t === 'string') token = t;
          }

          if (!token) return next(new Error('No auth token'));
          if (typeof token === 'string') {
            token = token.replace(/^"|"$/g, '');
            if (token.startsWith('Bearer ')) token = token.slice(7);
          }

          try {
            const raw = jwt.verify(token, this.jwtSecret) as unknown;
            if (raw && typeof raw === 'object') {
              const p = raw as Record<string, unknown>;
              const userCandidate: Record<string, unknown> = {};
              const sub = typeof p['sub'] === 'string' ? p['sub'] : undefined;
              const email =
                typeof p['usua_email'] === 'string'
                  ? p['usua_email']
                  : typeof p['email'] === 'string'
                    ? p['email']
                    : undefined;
              const perf =
                typeof p['perf_id'] === 'number' ? p['perf_id'] : undefined;
              const tipr =
                typeof p['tipr_id'] === 'number' ? p['tipr_id'] : undefined;
              if (sub) userCandidate['usua_cedula'] = sub;
              if (email) userCandidate['usua_email'] = email;
              if (perf !== undefined) userCandidate['perf_id'] = perf;
              if (tipr !== undefined) userCandidate['tipr_id'] = tipr;
              const srec = socket as unknown as Record<string, unknown>;
              srec['data'] = srec['data'] ?? {};
              const sd = srec['data'] as Record<string, unknown>;
              if (typeof userCandidate['usua_cedula'] === 'string') {
                const v: string = String(userCandidate['usua_cedula']);
                sd['usua_cedula'] = v;
              }
              if (typeof userCandidate['usua_email'] === 'string') {
                const v: string = String(userCandidate['usua_email']);
                sd['usua_email'] = v;
              }
              if (typeof userCandidate['perf_id'] === 'number') {
                const v: number = Number(userCandidate['perf_id']);
                sd['perf_id'] = v;
              }
              if (typeof userCandidate['tipr_id'] === 'number') {
                const v: number = Number(userCandidate['tipr_id']);
                sd['tipr_id'] = v;
              }
              return next();
            }
          } catch (verifyErr: unknown) {
            const project = await this.prisma.ticket_proyectos.findFirst({
              where: { tipr_token: String(token) },
            });
            if (project) {
              const srec = socket as unknown as Record<string, unknown>;
              srec['data'] = srec['data'] ?? {};
              const sd = srec['data'] as Record<string, unknown>;
              sd['tipr_id'] = project.tipr_id;
              sd['project_token'] = true;
              return next();
            }
            this.logger.warn('Socket auth failed: ' + String(verifyErr));
            return next(new Error('Token inválido'));
          }
        } catch (err: unknown) {
          this.logger.warn('Socket auth failed: ' + String(err));
          return next(new Error('Token inválido'));
        }
      })().catch((err: unknown) => {
        this.logger.warn('Socket auth unexpected error: ' + String(err));
        return next(new Error('Token inválido'));
      });
    });
  }

  private extractErrorMessage(err: unknown): string | undefined {
    if (!err || typeof err !== 'object') return undefined;
    const e = err as Record<string, unknown>;
    if (typeof e['message'] === 'string') return e['message'];
    if (typeof e['response'] === 'object' && e['response'] !== null) {
      const r = e['response'] as Record<string, unknown>;
      if (typeof r['message'] === 'string') return r['message'];
    }
    return undefined;
  }

  @SubscribeMessage('join_ticket')
  async handleJoin(
    @MessageBody()
    payload: { tick_id?: number; ticket_id?: number; id?: number },
    @ConnectedSocket() client: Socket & { data?: Record<string, unknown> },
  ) {
    // soportar tanto `tick_id` como `ticket_id` según el cliente
    const tickId = Number(
      payload?.tick_id ?? payload?.ticket_id ?? payload?.id,
    );
    if (!tickId || isNaN(tickId))
      return { status: 'error', message: 'tick_id inválido' };
    const room = `ticket_${tickId}`;
    try {
      const ticket = await this.ticketsService.findOne(tickId);
      const sd = client.data as Record<string, unknown> | undefined;
      const user = sd && this.isAuthUser(sd) ? sd : undefined;
      if (!ticket) return { status: 'error', message: 'Ticket no existe' };
      // El chat sólo está permitido cuando el ticket ha sido asignado
      if (!ticket.tick_usuario_asignado)
        return { status: 'forbidden', reason: 'ticket_not_assigned' };
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
        this.logger.warn(
          'No se pudo cargar el historial de chat para el ticket ' +
            String(payload.tick_id) +
            ': ' +
            String(this.extractErrorMessage(err) ?? String(err)),
        );
        return { status: 'joined', tick_id: payload.tick_id, messages: [] };
      }
    } catch (err) {
      this.logger.error(
        'join_ticket error: ' + (this.extractErrorMessage(err) ?? String(err)),
      );
      const reason = this.extractErrorMessage(err) ?? 'internal_error';
      return { status: 'error', reason };
    }
  }

  @SubscribeMessage('message')
  async handleMessage(
    @MessageBody()
    payload: {
      tick_id?: number;
      ticket_id?: number;
      id?: number;
      message?: string;
      fileUrl?: string;
    },
    @ConnectedSocket() client: Socket & { data?: Record<string, unknown> },
  ) {
    const tickId = Number(
      payload?.tick_id ?? payload?.ticket_id ?? payload?.id,
    );
    if (!tickId || isNaN(tickId))
      return { status: 'error', message: 'tick_id inválido' };
    const room = `ticket_${tickId}`;
    const sd = client.data as Record<string, unknown> | undefined;
    const user = sd && this.isAuthUser(sd) ? sd : undefined;
    try {
      const normalizedSender =
        typeof user?.usua_cedula === 'string' ||
        typeof user?.usua_cedula === 'number'
          ? String(user.usua_cedula)
          : '0';
      const saved = await this.ticketsService.persistChatMessage(
        tickId,
        normalizedSender,
        payload.message,
        payload.fileUrl,
      );

      const savedObj: unknown = saved;
      const out: Record<string, unknown> = {};
      if (this.isRecord(savedObj)) {
        const r = savedObj;
        out.tich_id =
          typeof r['tich_id'] !== 'undefined' ? r['tich_id'] : r['id'];
        out.tick_id = r['tick_id'];
        out.usua_cedula = r['usua_cedula'];
        out.tich_mensaje =
          typeof r['tich_mensaje'] === 'string'
            ? r['tich_mensaje']
            : r['message'];
        out.tich_file_url =
          typeof r['tich_file_url'] === 'string'
            ? r['tich_file_url']
            : r['fileUrl'];
        out.fecha_sistema = r['fecha_sistema'] ?? r['createdAt'];
      }

      client.to(room).emit('message', out as unknown as object);

      // determinar presencia en la sala y crear notificaciones para usuarios que no estén conectados al chat
      try {
        const members = this.getRoomMembers(room);

        const isUserInRoom = (cedula: string) => {
          try {
            if (!cedula) return false;
            for (const sid of Array.from(members)) {
              const sidStr = String(sid);
              const sContainer =
                (this.server as unknown as Record<string, unknown>)?.sockets ??
                (this.server as unknown);
              if (!this.isRecord(sContainer)) continue;
              const sc = sContainer;
              let s: unknown = undefined;
              if (sc instanceof Map)
                s = (sc as Map<string, unknown>).get(sidStr);
              else if (this.isRecord(sc) && sc['sockets'] instanceof Map)
                s = (sc['sockets'] as Map<string, unknown>).get(sidStr);
              else
                s = this.isRecord(sc) ? (sc[sidStr] ?? undefined) : undefined;
              if (!s) continue;
              const sockRec = s as unknown as { data?: { user?: unknown } };
              const sockUser: unknown = sockRec.data
                ? sockRec.data.user
                : undefined;
              if (this.isRecord(sockUser)) {
                const su = sockUser;
                const candidate = su['usua_cedula'] ?? su['sub'];
                const candStr =
                  typeof candidate === 'string' || typeof candidate === 'number'
                    ? String(candidate)
                    : undefined;
                if (candStr && candStr === String(cedula)) return true;
              }
            }
          } catch {
            // ignorar
          }
          return false;
        };

        const ticketRec = await this.prisma.ticket.findUnique({
          where: { tick_id: tickId },
        });
        const assigned = ticketRec?.tick_usuario_asignado;
        const creator = ticketRec?.usua_cedula;
        const sender =
          typeof user?.usua_cedula === 'string' ||
          typeof user?.usua_cedula === 'number'
            ? String(user.usua_cedula)
            : '';
        const snippet = (payload.message || '').slice(0, 140);
        const msg = snippet
          ? `Nuevo mensaje en el ticket #${tickId}: "${snippet}"`
          : `Nuevo mensaje en el ticket #${tickId}`;

        // membersSet removed (unused)
        // notificar al usuario asignado si no está en el chat y no es el remitente
        if (
          assigned &&
          String(assigned) !== sender &&
          !isUserInRoom(String(assigned))
        ) {
          try {
            if (this.notificationsService)
              await this.notificationsService.createNotification({
                tick_id: tickId,
                tino_tipo: 'C',
                tino_mensaje: msg,
                tick_usuario_asignado: String(assigned),
              });
          } catch (e) {
            this.logger.warn(
              'Failed to create assigned-user notification: ' + String(e),
            );
          }
        }

        // notificar al creador del ticket si no está en el chat y no es el remitente
        if (
          creator &&
          String(creator) !== sender &&
          !isUserInRoom(String(creator))
        ) {
          try {
            if (this.notificationsService)
              await this.notificationsService.createNotification({
                tick_id: tickId,
                tino_tipo: 'C',
                tino_mensaje: msg,
                usua_cedula: String(creator),
              });
          } catch (e) {
            this.logger.warn(
              'Failed to create creator notification: ' + String(e),
            );
          }
        }
      } catch (e: unknown) {
        this.logger.warn(
          'Error while evaluating/creating chat notifications: ' +
            String(this.extractErrorMessage(e) ?? String(e)),
        );
      }

      return { status: 'ok', message: out };
    } catch (err: unknown) {
      this.logger.error(
        'message handler error: ' +
          (this.extractErrorMessage(err) ?? String(err)),
      );
      const reason = this.extractErrorMessage(err) ?? 'internal_error';
      return { status: 'error', reason };
    }
  }
}
