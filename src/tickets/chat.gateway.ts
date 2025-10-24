import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { Injectable } from '@nestjs/common';
import { TicketsService } from './tickets.service';

const JWT_SECRET = 'mi_secreto_super_seguro';

@WebSocketGateway({ namespace: '/ws/tickets' })
@Injectable()
export class ChatGateway implements OnGatewayConnection {
  constructor(private ticketsService: TicketsService) {}

  handleConnection(client: Socket, ...args: any[]) {
    try {
      const token = (client.handshake.auth && (client.handshake.auth as any).token) || (client.handshake.query && (client.handshake.query as any).token);
      if (!token) return client.disconnect();
      const payload: any = jwt.verify(token, JWT_SECRET);
      // attach minimal user info
      (client as any).user = { id: payload.sub, email: payload.email, role: payload.role };
    } catch (err) {
      return client.disconnect();
    }
  }

  @SubscribeMessage('join_ticket')
  async handleJoin(@MessageBody() payload: { ticketId: number }, @ConnectedSocket() client: Socket) {
    const room = `ticket_${payload.ticketId}`;
    // optional: check if user may join (creator, assigned, or superadmin)
    try {
      const ticket = await this.ticketsService.findOne(payload.ticketId);
      const user = (client as any).user;
      if (!ticket) return { status: 'error', message: 'Ticket no existe' };
      const allowed = user?.role === 'superadmin' || ticket.userId === user?.id || ticket.assignedTo === user?.id;
      if (!allowed) return { status: 'forbidden' };
      client.join(room);
      return { status: 'joined', ticketId: payload.ticketId };
    } catch (err) {
      return { status: 'error' };
    }
  }

  @SubscribeMessage('message')
  async handleMessage(@MessageBody() payload: any, @ConnectedSocket() client: Socket) {
    const room = `ticket_${payload.ticketId}`;
    const user = (client as any).user;
    // persist message
    try {
      const saved = await this.ticketsService.persistChatMessage(payload.ticketId, user?.id || 0, payload.message, payload.fileUrl);
      const out = { id: saved.id, ticketId: saved.ticketId, senderId: saved.senderId, message: saved.message, fileUrl: saved.fileUrl, createdAt: saved.createdAt };
      client.to(room).emit('message', out);
      return { status: 'ok', message: out };
    } catch (err) {
      return { status: 'error' };
    }
  }
}
