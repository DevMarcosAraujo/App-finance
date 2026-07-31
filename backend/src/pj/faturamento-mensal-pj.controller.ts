import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateFaturamentoMensalPjDto } from './dto/create-faturamento-mensal-pj.dto';
import { UpdateFaturamentoMensalPjDto } from './dto/update-faturamento-mensal-pj.dto';
import type { FaturamentoMensalPjResult } from './faturamento-mensal-pj.service';
import { FaturamentoMensalPjService } from './faturamento-mensal-pj.service';

@Controller('faturamentos-pj')
@UseGuards(JwtAuthGuard)
export class FaturamentoMensalPjController {
  constructor(private readonly service: FaturamentoMensalPjService) {}

  @Post()
  create(
    @Body() dto: CreateFaturamentoMensalPjDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FaturamentoMensalPjResult> {
    return this.service.create(user.id, dto);
  }

  @Get()
  findByMonth(
    @Query('empresaId') empresaId: string,
    @Query('ano', ParseIntPipe) ano: number,
    @Query('mes', ParseIntPipe) mes: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FaturamentoMensalPjResult[]> {
    return this.service.findByMonth(user.id, empresaId, ano, mes);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFaturamentoMensalPjDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FaturamentoMensalPjResult> {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.service.delete(user.id, id);
  }
}
