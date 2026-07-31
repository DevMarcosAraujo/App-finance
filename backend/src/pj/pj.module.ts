import { Module } from '@nestjs/common';
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
export class PjModule {}
