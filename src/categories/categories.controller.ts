import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { TicketCategoriasService } from './categories.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@Controller('categorias')
@ApiTags('categorias')
export class TicketCategoriasController {
  constructor(private service: TicketCategoriasService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get()
  findAll(@Query() query: any) {
    const hasPage = query?.page !== undefined || query?.perPage !== undefined;
    const page = query?.page ?? 1;
    const perPage = query?.perPage ?? 10;
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
