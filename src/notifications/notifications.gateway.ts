import { WebSocketGateway, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';

const JWT_SECRET = process.env.JWT_SECRET || 'mi_secreto_super_seguro';

@WebSocketGateway({ namespace: '/ws/notifications', cors: { origin: '*' } })
@Injectable()
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private server: Server;
  private readonly logger = new Logger(NotificationsGateway.name);
  constructor(private prisma: PrismaService) {}

  afterInit(server: Server) {
    this.server = server;
    // middleware to authenticate socket connections for notifications namespace
    server.use((socket: any, next: any) => {
      (async () => {
        try {
          let token = (socket.handshake.auth && socket.handshake.auth.token) || (socket.handshake.query && socket.handshake.query.token);
          if (!token) return next(); // allow anonymous connection, we'll still accept but can't emit user-targeted events
          if (typeof token === 'string') {
            token = token.replace(/^"|"$/g, '');
            if (token.startsWith('Bearer ')) token = token.slice(7);
          }
          try {
            const payload: any = jwt.verify(token, JWT_SECRET);
            socket.data = socket.data || {};
            socket.data.user = { usua_cedula: payload.sub, usua_email: payload.usua_email ?? payload.email, perf_id: payload.perf_id, tipr_id: payload.tipr_id };
            return next();
          } catch (e) {
            // try project token
            try {
              const project = await this.prisma.ticket_proyectos.findFirst({ where: { tipr_token: String(token) } });
              if (project) {
                socket.data = socket.data || {};
                socket.data.user = { tipr_id: project.tipr_id, project_token: true };
                return next();
              }
            } catch (ee) {
              // ignore
            }
            // token invalid -> continue without user info
            this.logger.warn('Notifications socket auth failed: ' + (e && (e as any).message ? (e as any).message : String(e)));
            return next();
          }
        } catch (err) {
          this.logger.warn('Notifications socket auth unexpected error: ' + String(err));
          return next();
        }
      })().catch((err) => {
        this.logger.warn('Notifications socket auth unexpected error: ' + String(err));
        return next();
      });
    });
  }

  handleConnection(client: Socket) {
    try {
      const u = (client as any).data?.user?.usua_cedula || (client as any).data?.user?.sub;
      this.logger.debug(`[NotificationsGateway] client connected ${client.id} user=${u}`);
      if (u) {
        // join a dedicated room per user to simplify targeted emits
        client.join(`user_${String(u)}`);
      }
    } catch (e) {
      this.logger.warn('[NotificationsGateway] handleConnection error: ' + String(e));
    }
  }

  handleDisconnect(client: Socket) {
    try {
      this.logger.debug(`[NotificationsGateway] client disconnected ${client.id}`);
    } catch (e) {
      // ignore
    }
  }

  async emitToUser(usua_cedula: string, payload: any) {
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
        this.logger.debug('emitToUser room emit failed, falling back to individual sockets: ' + String(e));
      }

      // Fallback: gather sockets list robustly across socket.io versions / adapters
      const socketsList: any[] = [];
      const sContainer: any = (this.server as any).sockets;
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
          const sockUser = (s as any).data?.user?.usua_cedula || (s as any).data?.user?.sub;
          if (sockUser && String(sockUser) === String(usua_cedula)) {
            (s as any).emit('notification', payload);
            matched++;
          }
        } catch (e) {
          // ignore per-socket errors
        }
      }
      this.logger.debug(`emitToUser fallback: matched sockets=${matched}`);
    } catch (e) {
      this.logger.warn('emitToUser failed: ' + String(e));
    }
  }

  async emitToAll(payload: any) {
    if (!this.server) return;
    this.server.emit('notification', payload);
  }
}
