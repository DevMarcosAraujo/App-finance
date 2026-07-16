import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CategoriaResult } from './categoria.service';
import { CategoriaService } from './categoria.service';

@Controller('categorias')
@UseGuards(JwtAuthGuard)
export class CategoriaController {
  constructor(private readonly categoriaService: CategoriaService) {}

  @Get()
  findAll(): Promise<CategoriaResult[]> {
    return this.categoriaService.findAll();
  }
}
