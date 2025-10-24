import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { IdentifiersService } from './identifiers.service';
import { CreateIdentifierDto } from './dto/create-identifier.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Get, Param, Put, Delete } from '@nestjs/common';
import { UpdateIdentifierDto } from './dto/update-identifier.dto';


@Controller('identifiers')
@ApiTags('identifiers')
export class IdentifiersController {
  constructor(private readonly identifiersService: IdentifiersService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post()
  @ApiOperation({ summary: 'Crear identificador', description: 'Crea un nuevo identificador para usar en tickets. Nombre único.' })
  @ApiResponse({ status: 201, description: 'Identificador creado correctamente', schema: { example: { id: 1, name: 'Placa', description: 'Número de placa', dataType: 'string' } } })
  @ApiResponse({ status: 400, description: 'Datos inválidos o identificador existente', schema: { example: { statusCode: 400, message: 'Identificador con ese nombre ya existe' } } })
  @ApiResponse({ status: 401, description: 'No autorizado', schema: { example: { statusCode: 401, message: 'No autorizado' } } })
  create(@Body() dto: CreateIdentifierDto) {
    return this.identifiersService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get()
  @ApiOperation({ summary: 'Listar identificadores', description: 'Devuelve todos los identificadores disponibles.' })
  @ApiResponse({ status: 200, description: 'Listado de identificadores', schema: { example: [{ id: 1, name: 'Placa', dataType: 'string' }] } })
  findAll() {
    return this.identifiersService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get(':id')
  @ApiOperation({ summary: 'Obtener identificador', description: 'Devuelve un identificador por su ID.' })
  @ApiResponse({ status: 200, description: 'Identificador encontrado' })
  findOne(@Param('id') id: string) {
    return this.identifiersService.findOne(Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Put(':id')
  @ApiOperation({ summary: 'Actualizar identificador', description: 'Actualiza los campos del identificador.' })
  update(@Param('id') id: string, @Body() dto: UpdateIdentifierDto) {
    return this.identifiersService.update(Number(id), dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar identificador', description: 'Elimina un identificador.' })
  remove(@Param('id') id: string) {
    return this.identifiersService.remove(Number(id));
  }
}
