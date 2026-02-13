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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@Controller('prioridades')
@ApiTags('prioridades')
export class TicketPrioridadesController {
  constructor(private service: TicketPrioridadesService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get()
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
