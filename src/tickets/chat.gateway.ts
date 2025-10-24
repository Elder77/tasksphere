import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayInit } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { Injectable, Logger } from '@nestjs/common';
import { TicketsService } from './tickets.service';

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
  constructor(private ticketsService: TicketsService) {}

  afterInit(server: Server) {
    // middleware to authenticate socket connections
    server.use((socket: any, next: any) => {
      try {
        let token = (socket.handshake.auth && socket.handshake.auth.token) || (socket.handshake.query && socket.handshake.query.token);
        if (!token) return next(new Error('No auth token'));
        if (typeof token === 'string') {
          // strip surrounding quotes if present
          token = token.replace(/^\"|\"$/g, '');
          // strip Bearer prefix if provided
          if (token.startsWith('Bearer ')) token = token.slice(7);
        }
        const payload: any = jwt.verify(token, JWT_SECRET);
        // attach minimal user info to socket.data for later handlers
        socket.data = socket.data || {};
        socket.data.user = { id: payload.sub, email: payload.email, role: payload.role };
        return next();
      } catch (err) {
        this.logger.warn('Socket auth failed: ' + (err && (err as any).message ? (err as any).message : String(err)));
        return next(new Error('Token inválido'));
      }
    });
  }

  @SubscribeMessage('join_ticket')
  async handleJoin(@MessageBody() payload: { ticketId: number }, @ConnectedSocket() client: Socket) {
    const room = `ticket_${payload.ticketId}`;
    try {
      const ticket = await this.ticketsService.findOne(payload.ticketId);
      const user = (client as any).data?.user;
      if (!ticket) return { status: 'error', message: 'Ticket no existe' };
      const allowed = user?.role === 'user' || ticket.userId === user?.id || ticket.assignedTo === user?.id;
      if (!allowed) return { status: 'forbidden', reason: 'not_allowed' };
      client.join(room);
      return { status: 'joined', ticketId: payload.ticketId };
    } catch (err) {
      this.logger.error('join_ticket error', err as any);
      // If the service threw a NotFoundException, include that reason; otherwise include generic message
      const reason = err && (err.message || (err.response && err.response.message)) ? (err.message || err.response.message) : 'internal_error';
      return { status: 'error', reason };
    }
  }

  @SubscribeMessage('message')
  async handleMessage(@MessageBody() payload: any, @ConnectedSocket() client: Socket) {
    const room = `ticket_${payload.ticketId}`;
    const user = (client as any).data?.user;
    try {
      const saved = await this.ticketsService.persistChatMessage(payload.ticketId, user?.id || 0, payload.message, payload.fileUrl);
      const out = { id: saved.id, ticketId: saved.ticketId, senderId: saved.senderId, message: saved.message, fileUrl: saved.fileUrl, createdAt: saved.createdAt };
      client.to(room).emit('message', out);
      return { status: 'ok', message: out };
    } catch (err) {
      this.logger.error('message handler error', err as any);
      const reason = err && (err.message || (err.response && err.response.message)) ? (err.message || err.response.message) : 'internal_error';
      return { status: 'error', reason };
    }
  }
}
