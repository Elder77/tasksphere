import {
  Controller,
  Post,
  Body,
  UseGuards,
  Query,
  Get,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import { IdentifiersService } from './identifiers.service';
import { CreateIdentifierDto } from './dto/create-identifier.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
// ...existing imports consolidated above
import { UpdateIdentifierDto } from './dto/update-identifier.dto';

@Controller('identifiers')
@ApiTags('identifiers')
export class IdentifiersController {
  constructor(private readonly identifiersService: IdentifiersService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post()
  @ApiOperation({
    summary: 'Crear identificador',
    description:
      'Crea un nuevo identificador para usar en tickets. Nombre único.',
  })
  @ApiResponse({
    status: 201,
    description: 'Identificador creado correctamente',
    schema: {
      example: {
        tiid_id: 1,
        tipr_id: '1',
        tiid_nombre: 'Placa',
        tiid_descripcion: 'Número de placa',
        tiid_tipo_dato: 'string',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o identificador existente',
    schema: {
      example: {
        statusCode: 400,
        message: 'Identificador con ese nombre ya existe',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
    schema: { example: { statusCode: 401, message: 'No autorizado' } },
  })
  create(@Body() dto: CreateIdentifierDto) {
    return this.identifiersService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get()
  @ApiOperation({
    summary: 'Listar identificadores',
    description: 'Devuelve todos los identificadores disponibles.',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de identificadores',
    schema: {
      example: [{ tiid_id: 1, tiid_nombre: 'Placa', tiid_tipo_dato: 'string' }],
    },
  })
  findAll(@Query() query: { page?: string; perPage?: string; q?: string }) {
    const hasPage = query?.page !== undefined || query?.perPage !== undefined;
    const page = query?.page ? Number(query.page) : 1;
    const perPage = query?.perPage ? Number(query.perPage) : 10;
    const q = query?.q ?? undefined;
    if (hasPage) return this.identifiersService.findAllPaged(page, perPage, q);
    return this.identifiersService.findAll(q);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get(':tiid_id')
  @ApiOperation({
    summary: 'Obtener identificador',
    description: 'Devuelve un identificador por su ID.',
  })
  @ApiResponse({ status: 200, description: 'Identificador encontrado' })
  findOne(@Param('tiid_id') id: string) {
    return this.identifiersService.findOne(Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Put(':tiid_id')
  @ApiOperation({
    summary: 'Actualizar identificador',
    description: 'Actualiza los campos del identificador.',
  })
  update(@Param('tiid_id') tiid_id: string, @Body() dto: UpdateIdentifierDto) {
    return this.identifiersService.update(Number(tiid_id), dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Delete(':tiid_id')
  @ApiOperation({
    summary: 'Eliminar identificador',
    description: 'Elimina un identificador.',
  })
  remove(@Param('tiid_id') tiid_id: string) {
    return this.identifiersService.remove(Number(tiid_id));
  }
}
