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
import { TicketPrioridadesService } from './priorities.service';
import { CreatePrioridadDto } from './dto/create-prioridad.dto';
import { UpdatePrioridadDto } from './dto/update-prioridad.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@Controller('prioridades')
@ApiTags('prioridades')
export class TicketPrioridadesController {
  constructor(private service: TicketPrioridadesService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get()
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'perPage', required: false })
  @ApiQuery({ name: 'q', required: false, description: 'Texto a buscar' })
  @ApiOperation({ summary: 'Listar prioridades', description: 'Devuelve listado de prioridades. Soporta paginación con `page` y `perPage`.' })
  @ApiResponse({
    status: 200,
    description: 'Listado de prioridades (posible paginado)',
    schema: {
      example: {
        data: [{ prio_id: 1, prio_nombre: 'Alta' }],
        meta: { total: 5, page: 1, perPage: 10, totalPages: 1, from: 1, to: 5, range: 'Mostrando del 1 al 5 de 5' },
      },
    },
  })
  findAll(@Query() query: unknown) {
    const qObj = (query as Record<string, unknown>) ?? {};
    const hasPage =
      typeof qObj.page !== 'undefined' || typeof qObj.perPage !== 'undefined';
    const page =
      typeof qObj.page === 'string' || typeof qObj.page === 'number'
        ? Number(qObj.page)
        : 1;
    const perPage =
      typeof qObj.perPage === 'string' || typeof qObj.perPage === 'number'
        ? Math.min(Number(qObj.perPage), 100)
        : 10;
    const q =
      typeof qObj.q === 'string'
        ? qObj.q
        : typeof qObj.search === 'string'
          ? qObj.search
          : undefined;
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
  create(@Body() body: CreatePrioridadDto) {
    return this.service.create(body);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdatePrioridadDto) {
    return this.service.update(Number(id), body);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id));
  }
}
