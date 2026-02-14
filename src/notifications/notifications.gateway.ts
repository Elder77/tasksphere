import {
  WebSocketGateway,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';

import { ConfigService } from '../config/config.service';

@WebSocketGateway({ namespace: '/ws/notifications', cors: { origin: '*' } })
@Injectable()
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  // Gateway para notificaciones en tiempo real.
  // Seguridad / auditoría:
  // - El middleware acepta conexiones anónimas pero marca sockets autenticados con
  //   identificadores mínimos (ej. `usua_cedula`, `tipr_id`).
  // - Nunca almacenar tokens en `socket.data` ni escribir datos sensibles en logs.
  // - Emitir eventos por sala (`user_<cedula>`) cuando sea posible para eficiencia.
  private server: Server;
  private readonly logger = new Logger(NotificationsGateway.name);
  private jwtSecret: string;
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.jwtSecret = this.config.getJwtSecret();
  }

  private isUserObject(
    x: unknown,
  ): x is { usua_cedula?: string; sub?: string } {
    if (typeof x !== 'object' || x === null) return false;
    const r = x as Record<string, unknown>;
    return (
      typeof r['usua_cedula'] !== 'undefined' || typeof r['sub'] !== 'undefined'
    );
  }

  private isRecord(x: unknown): x is Record<string, unknown> {
    return typeof x === 'object' && x !== null;
  }

  private getAllSockets(): Socket[] {
    const socketsList: Socket[] = [];
    try {
      const serverAny: unknown = this.server as unknown;
      if (!this.isRecord(serverAny)) return socketsList;

      const serverRec = serverAny;
      const container =
        serverRec['sockets'] ?? serverRec['adapter'] ?? serverAny;

      if (container instanceof Map) {
        socketsList.push(
          ...Array.from((container as Map<string, Socket>).values()),
        );
      } else if (Array.isArray(container)) {
        socketsList.push(...(container as Socket[]));
      } else if (this.isRecord(container)) {
        const contRec = container;
        const roomsVal = contRec['values'] ?? contRec['sockets'] ?? undefined;
        if (roomsVal instanceof Map) {
          socketsList.push(
            ...Array.from((roomsVal as Map<string, Socket>).values()),
          );
        } else if (Array.isArray(roomsVal)) {
          socketsList.push(...(roomsVal as unknown as Socket[]));
        } else {
          socketsList.push(...(Object.values(container) as Socket[]));
        }
      } else if (Array.isArray(serverAny)) {
        socketsList.push(...(serverAny as unknown as Socket[]));
      }
    } catch {
      // ignorar
    }
    return socketsList;
  }

  private extractErrorMessage(err: unknown): string | undefined {
    if (!err || typeof err !== 'object') return undefined;
    const e = err as Record<string, unknown>;
    if (typeof e['message'] === 'string') return e['message'];
    return undefined;
  }

  afterInit(server: Server) {
    this.server = server;
    // Middleware para autenticar conexiones de socket en el namespace de notificaciones
    server.use(
      (
        socket: Socket & { data?: Record<string, unknown> },
        next: (err?: Error) => void,
      ) => {
        void (async () => {
          try {
            const authPart: unknown = socket.handshake.auth;
            const queryPart: unknown = socket.handshake.query;
            let token: string | undefined;

            if (
              authPart &&
              typeof authPart === 'object' &&
              'token' in authPart
            ) {
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

            if (!token) return next(); // permitir conexiones anónimas

            if (typeof token === 'string') {
              token = token.replace(/^"|"$/g, '');
              if (token.startsWith('Bearer ')) token = token.slice(7);
            }

            try {
              const raw = jwt.verify(token, this.jwtSecret) as unknown;
              if (this.isRecord(raw)) {
                const p = raw;
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

                const cedulaVal = sub;
                const emailVal = email;
                const perfVal = perf;
                const tiprVal = tipr;

                const maybeUser: Record<string, unknown> = {};
                if (typeof cedulaVal === 'string')
                  maybeUser['usua_cedula'] = cedulaVal;
                if (typeof emailVal === 'string')
                  maybeUser['usua_email'] = emailVal;
                if (typeof perfVal === 'number') maybeUser['perf_id'] = perfVal;
                if (typeof tiprVal === 'number') maybeUser['tipr_id'] = tiprVal;

                if (this.isUserObject(maybeUser)) {
                  const srec = socket as unknown as Record<string, unknown>;
                  srec['data'] = srec['data'] ?? {};
                  const sd = srec['data'] as Record<string, unknown>;
                  if (typeof cedulaVal === 'string') {
                    const v: string = String(cedulaVal);
                    sd['usua_cedula'] = v;
                  }
                  if (typeof emailVal === 'string') {
                    const v: string = String(emailVal);
                    sd['usua_email'] = v;
                  }
                  if (typeof perfVal === 'number') {
                    const v: number = Number(perfVal);
                    sd['perf_id'] = v;
                  }
                  if (typeof tiprVal === 'number') {
                    const v: number = Number(tiprVal);
                    sd['tipr_id'] = v;
                  }
                  return next();
                }
              }
            } catch (verifyErr: unknown) {
              try {
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
              } catch (dbErr: unknown) {
                this.logger.debug(
                  'Project token lookup failed: ' +
                    String(this.extractErrorMessage(dbErr) ?? String(dbErr)),
                );
              }
              this.logger.warn(
                'Notifications socket auth failed for token: ' +
                  String(
                    this.extractErrorMessage(verifyErr) ?? String(verifyErr),
                  ),
              );
              return next();
            }
          } catch (err: unknown) {
            this.logger.warn(
              'Error inesperado en autenticación de socket: ' +
                String(this.extractErrorMessage(err) ?? err),
            );
            return next();
          }
        })().catch((err: unknown) => {
          this.logger.warn(
            'Error inesperado en autenticación de socket: ' +
              String(this.extractErrorMessage(err) ?? err),
          );
          return next();
        });
      },
    );
  }

  handleConnection(client: Socket) {
    try {
      const dataRec = this.isRecord(
        (client as unknown as Record<string, unknown>).data,
      )
        ? (client as unknown as Record<string, unknown>).data
        : undefined;
      let u: string | undefined;
      if (dataRec) {
        const ced: unknown = dataRec['usua_cedula'];
        const sub: unknown = dataRec['sub'];
        u =
          typeof ced === 'string'
            ? ced
            : typeof sub === 'string'
              ? sub
              : undefined;
      }
      this.logger.debug(
        `[NotificationsGateway] client connected ${client.id} user=${u}`,
      );
      if (u) void client.join(`user_${String(u)}`);
    } catch (e: unknown) {
      this.logger.warn(
        '[NotificationsGateway] handleConnection error: ' +
          String(this.extractErrorMessage(e) ?? String(e)),
      );
    }
  }

  handleDisconnect(client: Socket) {
    try {
      this.logger.debug(
        `[NotificationsGateway] client disconnected ${client.id}`,
      );
    } catch {
      // ignorar
    }
  }

  emitToUser(usua_cedula: string, payload: unknown) {
    if (!this.server) return;
    try {
      // Preferir envío por sala: cada socket se une a la sala `user_<cedula>` al conectarse
      try {
        const room = `user_${String(usua_cedula)}`;
        this.server.to(room).emit('notification', payload);
        this.logger.debug(`emitToUser: emitted to room ${room}`);
        return;
      } catch (e) {
        // Alternativa: iterar por sockets individuales si el envío por sala falla
        this.logger.debug(
          'emitToUser room emit failed, falling back to individual sockets: ' +
            String(e),
        );
      }

      const socketsList = this.getAllSockets();
      let matched = 0;
      for (const s of socketsList) {
        try {
          let sData: unknown = undefined;
          if (this.isRecord(s))
            sData = (s as unknown as Record<string, unknown>)['data'];
          const uObj: unknown = this.isRecord(sData)
            ? sData['user']
            : undefined;
          if (this.isUserObject(uObj)) {
            const ru = uObj as Record<string, unknown>;
            const ced = ru['usua_cedula'];
            const sub = ru['sub'];
            const sockUser =
              typeof ced === 'string'
                ? ced
                : typeof sub === 'string'
                  ? sub
                  : undefined;
            if (sockUser && String(sockUser) === String(usua_cedula)) {
              s.emit('notification', payload);
              matched++;
            }
          }
        } catch {
          // ignorar errores por socket individual
        }
      }
      this.logger.debug(`emitToUser fallback: matched sockets=${matched}`);
    } catch (e: unknown) {
      this.logger.warn(
        'emitToUser falló: ' + String(this.extractErrorMessage(e) ?? String(e)),
      );
    }
  }

  emitToAll(payload: unknown) {
    if (!this.server) return;
    this.server.emit('notification', payload);
  }
}
