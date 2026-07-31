import { Controller, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import type { DASApuracaoResult } from './das-apuracao.service';
import { DASApuracaoService } from './das-apuracao.service';
import { EmpresaService } from './empresa.service';

@Controller('das-apuracoes')
@UseGuards(JwtAuthGuard)
export class DasApuracaoController {
  constructor(
    private readonly service: DASApuracaoService,
    private readonly empresaService: EmpresaService,
  ) {}

  @Get()
  async buscarPorMes(
    @Query('empresaId') empresaId: string,
    @Query('ano', ParseIntPipe) ano: number,
    @Query('mes', ParseIntPipe) mes: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DASApuracaoResult | null> {
    await this.empresaService.findOwned(user.id, empresaId);
    return this.service.buscarPorMes(empresaId, ano, mes);
  }
}
