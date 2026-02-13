import { Controller, Get, UseGuards, Query, Req, Patch, Param, Post, Body } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';

@Controller('notificaciones')
@ApiTags('notificaciones')
@ApiBearerAuth('access-token')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Listar notificaciones del usuario', description: 'Lista paginada de notificaciones del usuario autenticado' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'perPage', required: false })
  async findAll(@Req() req: any, @Query() query: any) {
    const user = req.user;
    const page = query?.page ?? 1;
    const perPage = query?.perPage ?? 10;
    return this.service.findForUserPaged(String(user?.usua_cedula ?? ''), page, perPage);
  }

  @UseGuards(JwtAuthGuard)
  @Get('unread-count')
  @ApiOperation({ summary: 'Contador de notificaciones no leídas', description: 'Devuelve la cantidad de notificaciones no leídas del usuario autenticado' })
  async unreadCount(@Req() req: any) {
    const user = req.user;
    const cnt = await this.service.countUnread(String(user?.usua_cedula ?? ''));
    return { unread: cnt };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar notificación como leída', description: 'Marca la notificación indicada como leída para el usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Notificación marcada' })
  async markRead(@Req() req: any, @Param('id') id: string) {
    const user = req.user;
    const res = await this.service.markAsRead(Number(id), String(user?.usua_cedula ?? ''));
    return { updated: res.count };
  }

  @UseGuards(JwtAuthGuard)
  @Post('mark-all-read')
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas', description: 'Marca todas las notificaciones no leídas del usuario autenticado como leídas' })
  @ApiBody({ schema: { type: 'object', properties: {} } })
  async markAllRead(@Req() req: any) {
    const user = req.user;
    const res = await this.service.markAllRead(String(user?.usua_cedula ?? ''));
    return { updated: res.count };
  }
}
