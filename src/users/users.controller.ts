import { Controller, Get, Post, Body,UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getAll() {
    return this.usersService.findAll();
  }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin') // 🔹 Solo los admin pueden acceder
  @Get('admin-only')
  @Post()
  async create(@Body() body: { name: string; email: string; password: string }) {
    return this.usersService.create(body);
  }
}
