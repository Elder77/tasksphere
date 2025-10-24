import { ApiProperty } from '@nestjs/swagger';

export class SocketMessageDto {
  @ApiProperty({ description: 'ID del ticket al que pertenece el mensaje', example: 123 })
  ticketId: number;

  @ApiProperty({ description: 'Texto del mensaje', example: 'Hola, necesito ayuda con X' })
  message: string;

  @ApiProperty({ description: 'URL pública de un archivo adjunto si aplica', required: false, example: '/uploads/chat/archivo.png' })
  fileUrl?: string;
}
