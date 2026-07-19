import { Module, OnModuleInit } from '@nestjs/common';
import { RendimentoAutonomoController } from './rendimento-autonomo.controller';
import { RendimentoAutonomoService } from './rendimento-autonomo.service';
import { DeducaoCarneLeaoController } from './deducao-carne-leao.controller';
import { DeducaoCarneLeaoService } from './deducao-carne-leao.service';
import { LivroCaixaController } from './livro-caixa.controller';
import { LivroCaixaService } from './livro-caixa.service';
import { ApuracaoCarneLeaoController } from './apuracao-carne-leao.controller';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';
import { ParametroFiscalPfService } from './parametro-fiscal-pf.service';
import { PARAMETRO_FISCAL_PF_2026 } from './parametro-fiscal-pf-2026.constants';

@Module({
  controllers: [
    RendimentoAutonomoController,
    DeducaoCarneLeaoController,
    LivroCaixaController,
    ApuracaoCarneLeaoController,
  ],
  providers: [
    RendimentoAutonomoService,
    DeducaoCarneLeaoService,
    LivroCaixaService,
    ApuracaoCarneLeaoService,
    ParametroFiscalPfService,
  ],
})
export class CarneLeaoModule implements OnModuleInit {
  constructor(private readonly parametroFiscalPfService: ParametroFiscalPfService) {}

  async onModuleInit(): Promise<void> {
    await this.parametroFiscalPfService.ensureSeed(2026, PARAMETRO_FISCAL_PF_2026);
  }
}
