import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { JoinTicketDto } from './dto/join-ticket.dto';
import { SocketMessageDto } from './dto/socket-message.dto';

@Controller('tickets/chat')
@ApiTags('chat')
@ApiBearerAuth('access-token')
export class ChatDocsController {
  @Post('join-example')
  @ApiOperation({
    summary: 'Ejemplo: unirse a una sala de ticket (WebSocket)',
    description: 'Este endpoint devuelve un ejemplo de payload para el evento `join_ticket` que se debe enviar vía WebSocket al namespace /ws/tickets.\n\nConexión (socket.io-client) – ejemplo:\n\n    // npm i socket.io-client\n    import { io } from \'socket.io-client\';\n\n    const token = \'<TU_JWT_AQUI>\'; // obtener con /auth/login\n    const socket = io(\'/ws/tickets\', { auth: { token } });\n\n    // Unirse a la sala del ticket\n    socket.emit(\'join_ticket\', { ticketId: 123 }, (response) => {\n      console.log(\'join response\', response);\n    });\n\nEl cliente debe incluir el JWT en la handshake (auth.token) o en la query string ?token=.',
  })
  @ApiBody({ type: JoinTicketDto })
  @ApiResponse({ status: 200, description: 'Respuesta de ejemplo cuando se une correctamente', schema: { example: { status: 'joined', ticketId: 123 } } })
  exampleJoin(@Body() body: JoinTicketDto) {
    return { status: 'joined', ticketId: body.ticketId };
  }

  @Post('message-example')
  @ApiOperation({
    summary: 'Ejemplo: enviar mensaje (WebSocket)',
    description: 'Devuelve un ejemplo de cómo debe ser el mensaje enviado por el evento `message` y la respuesta persistida.\n\nEjemplo de envío usando socket.io-client:\n\n    // asumiendo socket ya conectado y autenticado\n    socket.emit(\'message\', { ticketId: 123, message: \'Hola\', fileUrl: null }, (resp) => {\n      console.log(\'message response\', resp);\n    });\n\nEl token JWT debe pasarse en la handshake (auth.token) o en la query string ?token=.',
  })
  @ApiBody({ type: SocketMessageDto })
  @ApiResponse({ status: 200, description: 'Ejemplo de respuesta tras persistir y emitir el mensaje', schema: { example: { status: 'ok', message: { id: 1, ticketId: 123, senderId: 45, message: 'Hola', fileUrl: null, createdAt: '2025-10-23T00:00:00.000Z' } } } })
  exampleMessage(@Body() body: SocketMessageDto) {
    return {
      status: 'ok',
      message: {
        id: Math.floor(Math.random() * 1000),
        ticketId: body.ticketId,
        senderId: 0,
        message: body.message,
        fileUrl: body.fileUrl ?? null,
        createdAt: new Date().toISOString(),
      },
    };
  }
}
