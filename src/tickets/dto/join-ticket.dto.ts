import { ApiProperty } from '@nestjs/swagger';

export class JoinTicketDto {
  @ApiProperty({ description: 'ID del ticket al que se quiere unir', example: 123 })
  ticketId: number;
}
