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

  private extractErrorMessage(err: unknown): string | undefined {
    if (!err || typeof err !== 'object') return undefined;
    const e = err as Record<string, unknown>;
    if (typeof e['message'] === 'string') return e['message'];
    return undefined;
  }

  afterInit(server: Server) {
    this.server = server;
    // middleware to authenticate socket connections for notifications namespace
    server.use((socket: Socket, next: (err?: Error) => void) => {
      (async () => {
        try {
          const authPart = socket.handshake.auth;
          const queryPart = socket.handshake.query;
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

          if (!token) return next(); // anonymous allowed

          if (typeof token === 'string') {
            token = token.replace(/^"|"$/g, '');
            if (token.startsWith('Bearer ')) token = token.slice(7);
          }

          try {
            const raw = jwt.verify(token, this.jwtSecret) as unknown;
            if (raw && typeof raw === 'object') {
              const payload = raw as {
                sub?: string;
                usua_email?: string;
                email?: string;
                perf_id?: number;
                tipr_id?: number;
              };
              socket.data = socket.data || {};
              socket.data.user = {
                usua_cedula: payload.sub,
                usua_email: payload.usua_email ?? payload.email,
                perf_id: payload.perf_id,
                tipr_id: payload.tipr_id,
              };
              return next();
            }
          } catch (verifyErr) {
            try {
              const project = await this.prisma.ticket_proyectos.findFirst({
                where: { tipr_token: String(token) },
              });
              if (project) {
                socket.data = socket.data || {};
                socket.data.user = {
                  tipr_id: project.tipr_id,
                  project_token: true,
                };
                return next();
              }
            } catch (dbErr) {
              this.logger.debug(
                'Project token lookup failed: ' + String(dbErr),
              );
            }
            this.logger.warn(
              'Notifications socket auth failed for token: ' +
                String(verifyErr),
            );
            return next();
          }
        } catch (err) {
          this.logger.warn(
            'Notifications socket auth unexpected error: ' + String(err),
          );
          return next();
        }
      })().catch((err) => {
        this.logger.warn(
          'Notifications socket auth unexpected error: ' + String(err),
        );
        return next();
      });
    });
  }

  handleConnection(client: Socket) {
    try {
      const userObj: unknown = (client.data as unknown)?.user;
      let u: string | undefined;
      if (this.isUserObject(userObj)) {
        const r = userObj as Record<string, unknown>;
        const ced = r['usua_cedula'];
        const sub = r['sub'];
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
      if (u) {
        // join a dedicated room per user to simplify targeted emits
        client.join(`user_${String(u)}`);
      }
    } catch (e) {
      this.logger.warn(
        '[NotificationsGateway] handleConnection error: ' + String(e),
      );
    }
  }

  handleDisconnect(client: Socket) {
    try {
      this.logger.debug(
        `[NotificationsGateway] client disconnected ${client.id}`,
      );
    } catch {
      // ignore
    }
  }

  emitToUser(usua_cedula: string, payload: unknown) {
    if (!this.server) return;
    try {
      // Prefer room-based emit: each socket joins room `user_<cedula>` on connect
      try {
        const room = `user_${String(usua_cedula)}`;
        this.server.to(room).emit('notification', payload);
        this.logger.debug(`emitToUser: emitted to room ${room}`);
        return;
      } catch (e) {
        // fallback to per-socket iteration if room emit fails
        this.logger.debug(
          'emitToUser room emit failed, falling back to individual sockets: ' +
            String(e),
        );
      }

      // Fallback: gather sockets list robustly across socket.io versions / adapters
      const socketsList: Socket[] = [];
      const sContainer: unknown = (
        this.server as unknown as { sockets?: unknown }
      ).sockets;
      if (!sContainer) {
        this.logger.debug('No sockets container available on server');
        return;
      }

      // v4: sContainer.sockets is a Map of Socket instances
      if (sContainer.sockets) {
        const s = sContainer.sockets;
        if (typeof s.values === 'function') {
          socketsList.push(...Array.from(s.values()));
        } else if (Array.isArray(s)) {
          socketsList.push(...s);
        } else if (s instanceof Map) {
          socketsList.push(...Array.from(s.values()));
        } else if (typeof s === 'object') {
          socketsList.push(...Object.values(s));
        }
      } else if (typeof sContainer.connected === 'object') {
        // older socket.io versions
        socketsList.push(...Object.values(sContainer.connected));
      } else if (Array.isArray(sContainer)) {
        socketsList.push(...sContainer);
      }

      let matched = 0;
      for (const s of socketsList) {
        try {
          const uObj: unknown = (s as Socket & { data?: unknown }).data?.user;
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
          // ignore per-socket errors
        }
      }
      this.logger.debug(`emitToUser fallback: matched sockets=${matched}`);
    } catch (e) {
      this.logger.warn('emitToUser failed: ' + String(e));
    }
  }

  emitToAll(payload: unknown) {
    if (!this.server) return;
    this.server.emit('notification', payload);
  }
}
