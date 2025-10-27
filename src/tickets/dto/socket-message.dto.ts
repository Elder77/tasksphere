import { ApiProperty } from '@nestjs/swagger';

export class SocketMessageDto {
  @ApiProperty({ description: 'ID del ticket al que pertenece el mensaje', example: 123 })
  tick_id: number;

  @ApiProperty({ description: 'Texto del mensaje', example: 'Hola, necesito ayuda con X' })
  tich_mensaje: string;

  @ApiProperty({ description: 'URL pública de un archivo adjunto si aplica', required: false, example: '/uploads/chat/archivo.png' })
  tich_file_url?: string;
}
