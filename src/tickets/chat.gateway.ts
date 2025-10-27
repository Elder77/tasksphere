import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayInit } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { Injectable, Logger } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(private ticketsService: TicketsService, private prisma: PrismaService) {}

  afterInit(server: Server) {
    // middleware to authenticate socket connections
    server.use((socket: any, next: any) => {
      (async () => {
        try {
          let token = (socket.handshake.auth && socket.handshake.auth.token) || (socket.handshake.query && socket.handshake.query.token);
          if (!token) return next(new Error('No auth token'));
          if (typeof token === 'string') {
            // strip surrounding quotes if present
            token = token.replace(/^\"|\"$/g, '');
            // strip Bearer prefix if provided
            if (token.startsWith('Bearer ')) token = token.slice(7);
          }

          try {
            const payload: any = jwt.verify(token, JWT_SECRET);
            // attach minimal user info to socket.data for later handlers
            socket.data = socket.data || {};
            socket.data.user = {
              usua_cedula: payload.sub,
              usua_email: payload.usua_email ?? payload.email,
              perf_id: payload.perf_id,
              proy_id: payload.proy_id,
            };
            return next();
          } catch (e) {
            // if JWT verification failed, try project token lookup in DB
            const project = await this.prisma.proyectos.findFirst({ where: { proy_token: String(token) } });
            if (project) {
              socket.data = socket.data || {};
              socket.data.user = { proy_id: project.proy_id, project_token: true };
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
  async handleJoin(@MessageBody() payload: { tick_id: number }, @ConnectedSocket() client: Socket) {
    const room = `ticket_${payload.tick_id}`;
    try {
      const ticket = await this.ticketsService.findOne(payload.tick_id);
      const user = (client as any).data?.user;
      if (!ticket) return { status: 'error', message: 'Ticket no existe' };
      // Chat only allowed when ticket has been assigned
      if (!ticket.tick_usuario_asignado) return { status: 'forbidden', reason: 'ticket_not_assigned' };
      const allowed =
        // admin (perf_id=2) or creator or assigned user
        user?.perf_id === 2 ||
        ticket.usua_cedula === user?.usua_cedula ||
        ticket.tick_usuario_asignado === user?.usua_cedula;
      if (!allowed) return { status: 'forbidden', reason: 'not_allowed' };
      client.join(room);
      // fetch chat history and include it in the join response
      try {
        const messages = await this.ticketsService.getChatMessages(payload.tick_id);
        return { status: 'joined', tick_id: payload.tick_id, messages };
      } catch (err) {
        // if messages can't be loaded, still allow join but inform client
        this.logger.warn('Could not load chat history for ticket ' + payload.tick_id + ': ' + (err as any).message);
        return { status: 'joined', tick_id: payload.tick_id, messages: [] };
      }
    } catch (err) {
      this.logger.error('join_ticket error', err as any);
      // If the service threw a NotFoundException, include that reason; otherwise include generic message
      const reason = err && (err.message || (err.response && err.response.message)) ? (err.message || err.response.message) : 'internal_error';
      return { status: 'error', reason };
    }
  }

  @SubscribeMessage('message')
  async handleMessage(@MessageBody() payload: any, @ConnectedSocket() client: Socket) {
    const room = `ticket_${payload.tick_id}`;
  const user = (client as any).data?.user;
    try {
      const saved = await this.ticketsService.persistChatMessage(payload.tick_id, String(user?.usua_cedula ?? '0'), payload.message, payload.fileUrl);
      // normalize output using DB field names from Prisma models
      const out = {
        tich_id: (saved as any).tich_id ?? (saved as any).id,
        tick_id: (saved as any).tick_id,
        usua_cedula: (saved as any).usua_cedula,
        tich_mensaje: (saved as any).tich_mensaje ?? (saved as any).message,
        tich_file_url: (saved as any).tich_file_url ?? (saved as any).fileUrl,
        fecha_sistema: (saved as any).fecha_sistema ?? (saved as any).createdAt,
      };
      client.to(room).emit('message', out);
      return { status: 'ok', message: out };
    } catch (err) {
      this.logger.error('message handler error', err as any);
      const reason = err && (err.message || (err.response && err.response.message)) ? (err.message || err.response.message) : 'internal_error';
      return { status: 'error', reason };
    }
  }
}
