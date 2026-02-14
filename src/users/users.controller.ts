import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Patch,
  Param,
  Req,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiQuery({ name: 'page', required: false, description: 'Número de página (1-based)' })
  @ApiQuery({ name: 'perPage', required: false, description: 'Elementos por página' })
  @ApiQuery({ name: 'perf_id', required: false, description: 'Filtro por perfil (id)' })
  @ApiQuery({ name: 'usua_estado', required: false, description: 'Filtro por estado de usuario' })
  @ApiQuery({ name: 'all', required: false, description: 'Si true devuelve todos sin paginar' })
  @ApiOperation({ summary: 'Listar usuarios', description: 'Devuelve listado de usuarios. Soporta paginación con `page` y `perPage`.' })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios (con meta de paginación)',
    schema: {
      example: {
        data: [{ usua_cedula: '01020304050', usua_nombres: 'Juan' }],
        meta: {
          total: 100,
          page: 2,
          perPage: 10,
          totalPages: 10,
          from: 11,
          to: 20,
          range: 'Mostrando del 11 al 20 de 100',
        },
      },
    },
  })
  async getAll(
    @Query()
    query: {
      page?: string;
      perPage?: string;
      perf_id?: string;
      usua_estado?: string;
      all?: string;
    },
  ) {
    // soportar paginación: page, perPage
    const hasPage = query?.page !== undefined || query?.perPage !== undefined;
    const page = Number(query?.page ?? 1);
    const perPage = Number(query?.perPage ?? 10);
    // si hay filtros presentes (perf_id, usua_estado) devolver lista filtrada (sin paginación)
    if (
      query?.perf_id !== undefined ||
      query?.usua_estado !== undefined ||
      query?.all === 'true'
    ) {
      return this.usersService.findFiltered(query);
    }
    if (hasPage) {
      return this.usersService.findAllPaged(page, perPage);
    }
    // por defecto: devolver todos los usuarios (sin paginar) para compatibilidad con la UI de admin
    return this.usersService.findAll();
  }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin') // Solo los admin pueden crear usuarios
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':usua_cedula')
  async update(
    @Param('usua_cedula') usua_cedula: string,
    @Body() dto: UpdateUserDto,
    @Req() req: Request & { user?: { perf_id?: number; usua_cedula?: string } },
  ) {
    // permitir sólo al admin o al mismo usuario actualizar
    const authUser = req.user;
    if (authUser?.perf_id !== 2 && authUser?.usua_cedula !== usua_cedula) {
      throw new ForbiddenException('No autorizado');
    }
    return this.usersService.update(usua_cedula, dto);
  }
}
