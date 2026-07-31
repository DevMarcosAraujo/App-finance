import { Module, OnModuleInit } from '@nestjs/common';
import { CarneLeaoModule } from '../carne-leao/carne-leao.module';
import { EmpresaController } from './empresa.controller';
import { EmpresaService } from './empresa.service';
import { FaturamentoMensalPjController } from './faturamento-mensal-pj.controller';
import { FaturamentoMensalPjService } from './faturamento-mensal-pj.service';
import { ProLaboreController } from './pro-labore.controller';
import { ProLaboreService } from './pro-labore.service';
import { DistribuicaoLucrosController } from './distribuicao-lucros.controller';
import { DistribuicaoLucrosService } from './distribuicao-lucros.service';
import { DasApuracaoController } from './das-apuracao.controller';
import { DASApuracaoService } from './das-apuracao.service';
import { AcompanhamentoLimiteMeiController } from './acompanhamento-limite-mei.controller';
import { AcompanhamentoLimiteMeiService } from './acompanhamento-limite-mei.service';
import { RBT12Service } from './rbt12.service';
import { ParametroFiscalPjService } from './parametro-fiscal-pj.service';
import { AnexoSimplesTabelaService } from './anexo-simples-tabela.service';
import { PARAMETRO_FISCAL_PJ_2026 } from './parametro-fiscal-pj-2026.constants';
import { ANEXOS_SIMPLES_2026 } from './anexo-simples-tabela-2026.constants';

@Module({
  imports: [CarneLeaoModule],
  controllers: [
    EmpresaController,
    FaturamentoMensalPjController,
    ProLaboreController,
    DistribuicaoLucrosController,
    DasApuracaoController,
    AcompanhamentoLimiteMeiController,
  ],
  providers: [
    EmpresaService,
    FaturamentoMensalPjService,
    ProLaboreService,
    DistribuicaoLucrosService,
    DASApuracaoService,
    AcompanhamentoLimiteMeiService,
    RBT12Service,
    ParametroFiscalPjService,
    AnexoSimplesTabelaService,
  ],
})
export class PjModule implements OnModuleInit {
  constructor(
    private readonly parametroFiscalPjService: ParametroFiscalPjService,
    private readonly anexoSimplesTabelaService: AnexoSimplesTabelaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.parametroFiscalPjService.ensureSeed(2026, PARAMETRO_FISCAL_PJ_2026);
    for (const { anexo, faixas } of ANEXOS_SIMPLES_2026) {
      await this.anexoSimplesTabelaService.ensureSeed(2026, anexo, faixas);
    }
  }
}
