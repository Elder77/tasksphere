import {
  Controller,
  Get,
  UseGuards,
  Query,
  Req,
  Patch,
  Param,
  Post,
  Body,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';

@Controller('notificaciones')
@ApiTags('notificaciones')
@ApiBearerAuth('access-token')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  private extractUsua(req: unknown): string {
    const userObj: unknown = (req as { user?: unknown })?.user;
    if (typeof userObj !== 'object' || userObj === null) return '';
    const user = userObj as Record<string, unknown>;
    const val = user['usua_cedula'];
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    return '';
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({
    summary: 'Listar notificaciones del usuario',
    description: 'Lista paginada de notificaciones del usuario autenticado',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'perPage', required: false })
  async findAll(@Req() req: unknown, @Query() query: unknown) {
    const usua = this.extractUsua(req);
    const q = (query as Record<string, unknown> | undefined) ?? {};
    const page = Number(q.page ?? 1) || 1;
    const perPage = Number(q.perPage ?? 10) || 10;
    return this.service.findForUserPaged(String(usua), page, perPage);
  }

  @UseGuards(JwtAuthGuard)
  @Get('unread-count')
  @ApiOperation({
    summary: 'Contador de notificaciones no leídas',
    description:
      'Devuelve la cantidad de notificaciones no leídas del usuario autenticado',
  })
  async unreadCount(@Req() req: unknown) {
    const usua = this.extractUsua(req);
    const cnt = await this.service.countUnread(String(usua));
    return { unread: cnt };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  @ApiOperation({
    summary: 'Marcar notificación como leída',
    description:
      'Marca la notificación indicada como leída para el usuario autenticado',
  })
  @ApiResponse({ status: 200, description: 'Notificación marcada' })
  async markRead(@Req() req: unknown, @Param('id') id: string) {
    const usua = this.extractUsua(req);
    const res = await this.service.markAsRead(Number(id), String(usua));
    return { updated: res.count };
  }

  @UseGuards(JwtAuthGuard)
  @Post('mark-all-read')
  @ApiOperation({
    summary: 'Marcar todas las notificaciones como leídas',
    description:
      'Marca todas las notificaciones no leídas del usuario autenticado como leídas',
  })
  @ApiBody({ schema: { type: 'object', properties: {} } })
  async markAllRead(@Req() req: unknown) {
    const usua = this.extractUsua(req);
    const res = await this.service.markAllRead(String(usua));
    return { updated: res.count };
  }
}
