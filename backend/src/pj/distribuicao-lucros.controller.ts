import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateDistribuicaoLucrosDto } from './dto/create-distribuicao-lucros.dto';
import { UpdateDistribuicaoLucrosDto } from './dto/update-distribuicao-lucros.dto';
import type { DistribuicaoLucrosResult } from './distribuicao-lucros.service';
import { DistribuicaoLucrosService } from './distribuicao-lucros.service';

@Controller('distribuicoes-lucros')
@UseGuards(JwtAuthGuard)
export class DistribuicaoLucrosController {
  constructor(private readonly service: DistribuicaoLucrosService) {}

  @Post()
  create(
    @Body() dto: CreateDistribuicaoLucrosDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DistribuicaoLucrosResult> {
    return this.service.create(user.id, dto);
  }

  @Get()
  findByMonth(
    @Query('empresaId') empresaId: string,
    @Query('ano', ParseIntPipe) ano: number,
    @Query('mes', ParseIntPipe) mes: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DistribuicaoLucrosResult[]> {
    return this.service.findByMonth(user.id, empresaId, ano, mes);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDistribuicaoLucrosDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DistribuicaoLucrosResult> {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.service.delete(user.id, id);
  }
}
