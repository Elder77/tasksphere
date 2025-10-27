import { Controller, Get, Post, Body, Param, Query, UseGuards, UploadedFiles, UseInterceptors, Put, Req, Res, StreamableFile, NotFoundException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Response } from 'express';
import { extname } from 'path';
import { ApiTags, ApiOperation, ApiQuery, ApiConsumes, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

interface AuthUser { usua_cedula?: string; perf_id?: number }

@Controller('tickets')
@ApiTags('tickets')
@ApiBearerAuth('access-token')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Listar tickets con paginación y filtros', description: 'Devuelve una lista paginada de tickets. Parámetros: page, perPage, status, module, search.' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'perPage', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'module', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, description: 'Lista de tickets devuelta correctamente', schema: { example: { data: [{ tick_id: 1, tick_nombre: 'Problema X', tick_estado: 'A', tick_id_identificador: 1, tick_modulo: 'Soporte' }], meta: { total: 1, page: 1, perPage: 10, totalPages: 1 } } } })
  @ApiResponse({ status: 400, description: 'Parámetros de consulta inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado. Token inválido o no provisto.' })
  findAll(@Req() req: any, @Query() query: any) {
    const user: any = req.user;
    return this.ticketsService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener ticket por ID', description: 'Devuelve el ticket indicado por ID junto a sus archivos y el historial.' })
  @ApiResponse({ status: 200, description: 'Ticket encontrado' })
  @ApiResponse({ status: 400, description: 'ID inválido' })
  @ApiResponse({ status: 404, description: 'Ticket no encontrado' })
  async findOne(@Req() req: any, @Param('id') id: string) {
    // If caller provided an Authorization header that could be a project token, restrict response to that proy_id
    const authHeader = req.headers?.authorization || null;
    if (authHeader) {
      let token = String(authHeader);
      if (token.startsWith('Bearer ')) token = token.slice(7);
      const project = await this.ticketsService.findProjectByToken(token);
      if (project) {
        const ticket = await this.ticketsService.findOne(+id);
        if (ticket.proy_id !== project.proy_id) throw new NotFoundException('Ticket no encontrado');
        return ticket;
      }
    }
    return this.ticketsService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Crear ticket', description: 'Crear un nuevo ticket. Se puede subir hasta 3 archivos (png, jpg, pdf, doc/docx, xls/xlsx) con máximo 5MB cada uno.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { tiid_id: { type: 'number' }, tick_nombre: { type: 'string' }, tick_descripcion: { type: 'string' }, tick_modulo: { type: 'string' }, usua_cedula: { type: 'string' }, attachments: { type: 'array', items: { type: 'string', format: 'binary' } } }, required: ['tiid_id', 'tick_nombre', 'tick_descripcion', 'tick_modulo', 'usua_cedula'] } })
  @ApiResponse({ status: 201, description: 'Ticket creado correctamente', schema: { example: { tick_id: 10, tick_nombre: 'Prueba e2e', tick_descripcion: 'Descripción prueba', tick_id_identificador: 1, tick_modulo: 'Soporte' } } })
  @ApiResponse({ status: 400, description: 'Datos inválidos o archivos no permitidos (tipo o tamaño)' })
  @ApiResponse({ status: 401, description: 'No autorizado. Token inválido o no provisto.' })
  @UseInterceptors(FilesInterceptor('attachments', 3))
  create(@Req() req: any, @Body() createDto: CreateTicketDto, @UploadedFiles() files?: Express.Multer.File[]) {
    const user: AuthUser = req.user;
    return this.ticketsService.create(createDto, files || [], user);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Editar ticket', description: 'Editar descripción ó módulo y agregar archivos (hasta 3). No se puede cambiar el identificador.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { tick_descripcion: { type: 'string' }, tick_modulo: { type: 'string' }, usua_cedula: { type: 'string' }, attachments: { type: 'array', items: { type: 'string', format: 'binary' } } }, required: [] } })
  @ApiResponse({ status: 200, description: 'Ticket actualizado correctamente', schema: { example: { tick_id: 10, tick_nombre: 'Prueba e2e', tick_descripcion: 'Descripción actualizada', tick_modulo: 'Soporte' } } })
  @ApiResponse({ status: 400, description: 'Datos inválidos o archivos no permitidos' })
  @ApiResponse({ status: 401, description: 'No autorizado. Token inválido o no provisto.' })
  @ApiResponse({ status: 403, description: 'Permisos insuficientes para editar este ticket' })
  @UseInterceptors(FilesInterceptor('attachments', 3))
  update(@Req() req: any, @Param('id') id: string, @Body() updateDto: UpdateTicketDto, @UploadedFiles() files?: Express.Multer.File[]) {
    const user: AuthUser = req.user;
    return this.ticketsService.update(+id, updateDto, files || [], user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('assign')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Asignar ticket', description: 'Asignar el ticket a un usuario. Sólo administradores (perf_id=2) pueden realizarlo.' })
  @ApiResponse({ status: 200, description: 'Ticket asignado correctamente' })
  @ApiResponse({ status: 400, description: 'ID inválido' })
  @ApiResponse({ status: 401, description: 'No autorizado. Token inválido o no provisto.' })
  @ApiResponse({ status: 403, description: 'Solo administradores (perf_id=2) pueden asignar tickets' })
  @ApiBody({ type: AssignTicketDto })
  assign(@Req() req: any, @Body() body: AssignTicketDto) {
    const user: AuthUser = req.user;
    return this.ticketsService.assign(Number(body.ticket_id), String(body.tick_usuario_asignado), user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/close')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cerrar ticket', description: 'Cerrar un ticket. Sólo administradores (perf_id=2) pueden cerrar. Se puede adjuntar evidencia (archivos).' })
  @UseInterceptors(FilesInterceptor('attachments', 3))
  @ApiResponse({ status: 200, description: 'Ticket cerrado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado. Token inválido o no provisto.' })
  @ApiResponse({ status: 403, description: 'Solo administradores (perf_id=2) pueden cerrar tickets' })
  close(@Req() req: any, @Param('id') id: string, @Body() body: any, @UploadedFiles() files?: Express.Multer.File[]) {
    const user: AuthUser = req.user;
    return this.ticketsService.close(+id, body.note, files || [], user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/reopen')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Reabrir ticket', description: 'Reabrir un ticket. Sólo el creador puede reabrir y debe indicar la razón.' })
  @ApiResponse({ status: 200, description: 'Ticket reabierto correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado. Token inválido o no provisto.' })
  @ApiResponse({ status: 403, description: 'Solo el creador puede reabrir el ticket' })
  @UseInterceptors(FilesInterceptor('attachments', 3))
  reopen(@Req() req: any, @Param('id') id: string, @Body() body: any, @UploadedFiles() files?: Express.Multer.File[]) {
    const user: AuthUser = req.user;
    return this.ticketsService.reopen(+id, body.reason, files || [], user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/files/:filename')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Descargar archivo de un ticket', description: 'Descarga un archivo adjunto del ticket si tienes permisos.' })
  @ApiResponse({ status: 200, description: 'Archivo descargado correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado. Token inválido o no provisto.' })
  @ApiResponse({ status: 403, description: 'Permisos insuficientes para descargar este archivo' })
  @ApiResponse({ status: 404, description: 'Archivo o ticket no encontrado' })
  async downloadFile(@Req() req: any, @Param('id') id: string, @Param('filename') filename: string, @Res({ passthrough: true }) res: any) {
    // ensure file exists in DB
    const files = await this.ticketsService.findOne(+id).then(t => (t as any).files as any[]).catch(() => null);
    if (!files) throw new NotFoundException('Ticket o archivos no encontrados');
    const file = files.find(f => f.filename === filename);
    if (!file) throw new NotFoundException('Archivo no encontrado');

    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    return new StreamableFile(require('fs').createReadStream(file.path));
  }
}
