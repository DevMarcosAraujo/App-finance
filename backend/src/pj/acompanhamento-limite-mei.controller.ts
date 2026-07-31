import { Controller, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import type { AcompanhamentoLimiteMeiResult } from './acompanhamento-limite-mei.service';
import { AcompanhamentoLimiteMeiService } from './acompanhamento-limite-mei.service';
import { EmpresaService } from './empresa.service';

@Controller('acompanhamento-limite-mei')
@UseGuards(JwtAuthGuard)
export class AcompanhamentoLimiteMeiController {
  constructor(
    private readonly service: AcompanhamentoLimiteMeiService,
    private readonly empresaService: EmpresaService,
  ) {}

  @Get()
  async buscarPorAno(
    @Query('empresaId') empresaId: string,
    @Query('ano', ParseIntPipe) ano: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AcompanhamentoLimiteMeiResult | null> {
    await this.empresaService.findOwned(user.id, empresaId);
    return this.service.buscarPorAno(empresaId, ano);
  }
}
