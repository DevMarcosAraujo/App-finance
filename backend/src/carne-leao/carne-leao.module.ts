import { Module } from '@nestjs/common';
import { RendimentoAutonomoController } from './rendimento-autonomo.controller';
import { RendimentoAutonomoService } from './rendimento-autonomo.service';
import { DeducaoCarneLeaoController } from './deducao-carne-leao.controller';
import { DeducaoCarneLeaoService } from './deducao-carne-leao.service';
import { LivroCaixaController } from './livro-caixa.controller';
import { LivroCaixaService } from './livro-caixa.service';
import { ApuracaoCarneLeaoController } from './apuracao-carne-leao.controller';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';
import { ParametroFiscalPfService } from './parametro-fiscal-pf.service';

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
export class CarneLeaoModule {}
