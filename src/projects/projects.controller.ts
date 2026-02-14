import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  Request,
  UnauthorizedException,
  Query,
} from '@nestjs/common';
import type { Request as ExRequest } from 'express';
import { TicketProyectosService } from './projects.service';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@Controller('proyectos')
@ApiTags('proyectos')
export class TicketProyectosController {
  constructor(private service: TicketProyectosService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get()
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'perPage', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'search', required: false, description: 'Alias para q' })
  @ApiOperation({ summary: 'Listar proyectos', description: 'Devuelve listado de proyectos. Soporta paginación con `page` y `perPage`.' })
  @ApiResponse({
    status: 200,
    description: 'Listado de proyectos (posible paginado)',
    schema: {
      example: {
        data: [{ tipr_id: 1, tipr_nombre: 'Proyecto A' }],
        meta: { total: 100, page: 2, perPage: 10, totalPages: 10, from: 11, to: 20, range: 'Mostrando del 11 al 20 de 100' },
      },
    },
  })
  findAll(
    @Request() req: ExRequest & { user?: { project_token?: boolean } },
    @Query()
    query: { page?: string; perPage?: string; q?: string; search?: string },
  ) {
    if (req.user && req.user.project_token) {
      throw new UnauthorizedException('No autorizado con token de proyecto');
    }
    const hasPage = query?.page !== undefined || query?.perPage !== undefined;
    const page = Number(query?.page ?? 1);
    const perPage = Number(query?.perPage ?? 10);
    // accept both `q` and `search` to be compatible with other modules
    const q = query?.q ?? query?.search ?? undefined;
    if (hasPage) return this.service.findAllPaged(page, perPage, q);
    return this.service.findAll(q);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get(':id')
  findOne(
    @Request() req: ExRequest & { user?: { project_token?: boolean } },
    @Param('id') id: string,
  ) {
    if (req.user && req.user.project_token) {
      throw new UnauthorizedException('No autorizado con token de proyecto');
    }
    return this.service.findOne(Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get(':id/users')
  async getUsers(
    @Request() req: ExRequest & { user?: { project_token?: boolean } },
    @Param('id') id: string,
  ) {
    if (req.user && req.user.project_token) {
      throw new UnauthorizedException('No autorizado con token de proyecto');
    }
    return this.service.getUsersForProject(Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post(':id/users')
  async setUsers(
    @Request() req: ExRequest & { user?: { project_token?: boolean } },
    @Param('id') id: string,
    @Body() body: { usua_cedulas?: string[] },
  ) {
    if (req.user && req.user.project_token) {
      throw new UnauthorizedException('No autorizado con token de proyecto');
    }
    const cedulas = Array.isArray(body?.usua_cedulas) ? body.usua_cedulas : [];
    return this.service.setUsersForProject(Number(id), cedulas);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post()
  create(
    @Request() req: ExRequest & { user?: { project_token?: boolean } },
    @Body() body: CreateProyectoDto,
  ) {
    // Disallow creating projects when the token used is a project token (project_token===true)
    if (req.user && req.user.project_token) {
      throw new UnauthorizedException(
        'No autorizado a crear proyectos con token de proyecto',
      );
    }
    return this.service.create(body);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Put(':id')
  update(
    @Request() req: ExRequest & { user?: { project_token?: boolean } },
    @Param('id') id: string,
    @Body() body: UpdateProyectoDto,
  ) {
    if (req.user && req.user.project_token) {
      throw new UnauthorizedException('No autorizado con token de proyecto');
    }
    return this.service.update(Number(id), body);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Delete(':id')
  remove(
    @Request() req: ExRequest & { user?: { project_token?: boolean } },
    @Param('id') id: string,
  ) {
    if (req.user && req.user.project_token) {
      throw new UnauthorizedException('No autorizado con token de proyecto');
    }
    return this.service.remove(Number(id));
  }
}
