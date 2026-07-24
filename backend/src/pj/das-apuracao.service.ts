import { BadRequestException, Injectable } from '@nestjs/common';
import { AtividadeEmpresa, Prisma, RegimeEmpresa, StatusApuracao } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ParametroFiscalPjService, ParametroFiscalPjResult } from './parametro-fiscal-pj.service';
import { AnexoSimplesTabelaService } from './anexo-simples-tabela.service';

export interface DASApuracaoResult {
  id: string;
  competencia: Date;
  regimeNoMomento: RegimeEmpresa;
  valorDevido: number;
  detalheCalculo: Record<string, unknown>;
  vencimento: Date;
  status: StatusApuracao;
}

interface RawDASApuracao {
  id: string;
  competencia: Date;
  regimeNoMomento: RegimeEmpresa;
  valorDevido: unknown;
  detalheCalculo: unknown;
  vencimento: Date;
  status: StatusApuracao;
}

@Injectable()
export class DASApuracaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametroFiscalPjService: ParametroFiscalPjService,
    private readonly anexoSimplesTabelaService: AnexoSimplesTabelaService,
  ) {}

  async recalcular(empresaId: string, competencia: Date): Promise<DASApuracaoResult> {
    const empresa = await this.prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } });
    const faturamento = await this.prisma.faturamentoMensalPJ.findUnique({
      where: { empresaId_competencia: { empresaId, competencia } },
    });
    const receitaMes = faturamento ? Number(faturamento.receitaBrutaTotal) : 0;

    let valorDevido: number;
    let detalheCalculo: Record<string, unknown>;

    if (empresa.regime === RegimeEmpresa.MEI) {
      const parametro = await this.parametroFiscalPjService.buscarPorAno(
        competencia.getUTCFullYear(),
      );
      const valorTabelado = this.valorDasMei(parametro, empresa.atividadeTipo);
      valorDevido = valorTabelado;
      detalheCalculo = { tipo: 'fixo', valorTabelado };
    } else {
      const rbt12Cache = await this.prisma.rBT12Cache.findUnique({
        where: { empresaId_competencia: { empresaId, competencia } },
      });
      const rbt12 = rbt12Cache ? Number(rbt12Cache.rbt12Calculado) : 0;
      const faixas = await this.anexoSimplesTabelaService.buscarFaixas(
        competencia.getUTCFullYear(),
        empresa.anexoSimples!,
      );
      const faixa = faixas.find((f) => rbt12 <= f.rbt12Ate) ?? faixas[faixas.length - 1];
      const aliquotaEfetiva =
        rbt12 > 0 ? (rbt12 * faixa.aliquota - faixa.parcelaDeduzir) / rbt12 : 0;
      valorDevido = Math.max(0, receitaMes * aliquotaEfetiva);
      detalheCalculo = {
        rbt12,
        anexo: empresa.anexoSimples,
        aliquotaNominal: faixa.aliquota,
        parcelaDeduzir: faixa.parcelaDeduzir,
        aliquotaEfetiva,
      };
    }

    const vencimento = this.calcularVencimento(competencia);

    const apuracao = await this.prisma.dASApuracao.upsert({
      where: { empresaId_competencia: { empresaId, competencia } },
      create: {
        empresaId,
        competencia,
        regimeNoMomento: empresa.regime,
        valorDevido,
        detalheCalculo: detalheCalculo as Prisma.InputJsonValue,
        vencimento,
        status: StatusApuracao.PENDENTE,
      },
      update: {
        regimeNoMomento: empresa.regime,
        valorDevido,
        detalheCalculo: detalheCalculo as Prisma.InputJsonValue,
        vencimento,
      },
    });

    return this.toResult(apuracao);
  }

  async buscarPorMes(
    empresaId: string,
    ano: number,
    mes: number,
  ): Promise<DASApuracaoResult | null> {
    if (mes < 1 || mes > 12) {
      throw new BadRequestException('mes deve estar entre 1 e 12');
    }
    const competencia = new Date(Date.UTC(ano, mes - 1, 1));
    const apuracao = await this.prisma.dASApuracao.findUnique({
      where: { empresaId_competencia: { empresaId, competencia } },
    });
    return apuracao ? this.toResult(apuracao) : null;
  }

  private valorDasMei(parametro: ParametroFiscalPjResult, atividade: AtividadeEmpresa): number {
    if (atividade === AtividadeEmpresa.SERVICO) {
      return parametro.meiDasServicos;
    }
    if (atividade === AtividadeEmpresa.COMERCIO_SERVICO) {
      return parametro.meiDasComercioServicos;
    }
    return parametro.meiDasComercioIndustria;
  }

  private calcularVencimento(competencia: Date): Date {
    const ano = competencia.getUTCFullYear();
    const mes = competencia.getUTCMonth();
    const vencimento = new Date(Date.UTC(ano, mes + 1, 20));
    const diaSemana = vencimento.getUTCDay();
    if (diaSemana === 0) {
      vencimento.setUTCDate(vencimento.getUTCDate() - 2);
    } else if (diaSemana === 6) {
      vencimento.setUTCDate(vencimento.getUTCDate() - 1);
    }
    return vencimento;
  }

  private toResult(apuracao: RawDASApuracao): DASApuracaoResult {
    return {
      id: apuracao.id,
      competencia: apuracao.competencia,
      regimeNoMomento: apuracao.regimeNoMomento,
      valorDevido: Number(apuracao.valorDevido),
      detalheCalculo: apuracao.detalheCalculo as Record<string, unknown>,
      vencimento: apuracao.vencimento,
      status: apuracao.status,
    };
  }
}
