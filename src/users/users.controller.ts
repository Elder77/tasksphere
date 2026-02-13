import { Controller, Get, Post, Body, UseGuards, Patch, Param, Req, ForbiddenException, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  async getAll(@Query() query: any) {
    // soportar paginación: page, perPage
    const hasPage = query?.page !== undefined || query?.perPage !== undefined;
    const page = query?.page ?? 1;
    const perPage = query?.perPage ?? 10;
    // si hay filtros presentes (perf_id, usua_estado) devolver lista filtrada (sin paginación)
    if (query?.perf_id !== undefined || query?.usua_estado !== undefined || query?.all === 'true') {
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
  async update(@Param('usua_cedula') usua_cedula: string, @Body() dto: UpdateUserDto, @Req() req: any) {
    // permitir sólo al admin o al mismo usuario actualizar
    const authUser: any = (req as any).user;
    if (authUser?.perf_id !== 2 && authUser?.usua_cedula !== usua_cedula) {
      throw new ForbiddenException('No autorizado');
    }
    return this.usersService.update(usua_cedula, dto as any);
  }
}
