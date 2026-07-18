import { Controller, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import type { ApuracaoCarneLeaoResult } from './apuracao-carne-leao.service';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';

@Controller('apuracoes-carne-leao')
@UseGuards(JwtAuthGuard)
export class ApuracaoCarneLeaoController {
  constructor(private readonly service: ApuracaoCarneLeaoService) {}

  @Get()
  buscarPorMes(
    @Query('ano', ParseIntPipe) ano: number,
    @Query('mes', ParseIntPipe) mes: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApuracaoCarneLeaoResult | null> {
    return this.service.buscarPorMes(user.id, ano, mes);
  }
}
