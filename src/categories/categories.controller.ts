import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { TicketCategoriasService } from './categories.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@Controller('categorias')
@ApiTags('categorias')
export class TicketCategoriasController {
  constructor(private service: TicketCategoriasService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get()
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'perPage', required: false })
  @ApiQuery({ name: 'q', required: false, description: 'Texto a buscar en categorías' })
  @ApiOperation({ summary: 'Listar categorías', description: 'Devuelve listado de categorías. Soporta paginación con `page` y `perPage`.' })
  @ApiResponse({
    status: 200,
    description: 'Listado de categorías (posible paginado)',
    schema: {
      example: {
        data: [{ tica_id: 1, tica_nombre: 'Soporte' }],
        meta: { total: 42, page: 1, perPage: 10, totalPages: 5, from: 1, to: 10, range: 'Mostrando del 1 al 10 de 42' },
      },
    },
  })
  findAll(@Query() query: { page?: string; perPage?: string; q?: string }) {
    const hasPage = query?.page !== undefined || query?.perPage !== undefined;
    const page = query?.page ? Number(query.page) : 1;
    const perPage = query?.perPage ? Number(query.perPage) : 10;
    const q = query?.q ?? undefined;
    if (hasPage) return this.service.findAllPaged(page, perPage, q);
    return this.service.findAll(q);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post()
  create(@Body() body: CreateCategoriaDto) {
    return this.service.create(body);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateCategoriaDto) {
    return this.service.update(Number(id), body);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id));
  }
}
