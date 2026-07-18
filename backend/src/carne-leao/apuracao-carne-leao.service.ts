import { BadRequestException, Injectable } from '@nestjs/common';
import { StatusApuracao } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ParametroFiscalPfService, FaixaProgressiva } from './parametro-fiscal-pf.service';

export interface ApuracaoCarneLeaoResult {
  id: string;
  competencia: Date;
  rendimentoBrutoTotal: number;
  deducoesTotal: number;
  baseCalculo: number;
  aliquotaEfetiva: number;
  impostoDevido: number;
  codigoReceita: string;
  vencimento: Date;
  status: StatusApuracao;
  calculoIncerto: boolean;
}

interface RawApuracao {
  id: string;
  competencia: Date;
  rendimentoBrutoTotal: unknown;
  deducoesTotal: unknown;
  baseCalculo: unknown;
  aliquotaEfetiva: unknown;
  impostoDevido: unknown;
  codigoReceita: string;
  vencimento: Date;
  status: StatusApuracao;
  calculoIncerto: boolean;
}

@Injectable()
export class ApuracaoCarneLeaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametroFiscalPfService: ParametroFiscalPfService,
  ) {}

  async recalcular(usuarioId: string, competencia: Date): Promise<ApuracaoCarneLeaoResult> {
    const inicioMes = new Date(
      Date.UTC(competencia.getUTCFullYear(), competencia.getUTCMonth(), 1),
    );

    const [rendimentos, deducoes, livroCaixaLancamentos, parametro] = await Promise.all([
      this.prisma.rendimentoAutonomo.findMany({ where: { usuarioId, competencia: inicioMes } }),
      this.prisma.deducaoCarneLeao.findMany({ where: { usuarioId, competencia: inicioMes } }),
      this.prisma.livroCaixaLancamento.findMany({ where: { usuarioId, competencia: inicioMes } }),
      this.parametroFiscalPfService.buscarPorAno(inicioMes.getUTCFullYear()),
    ]);

    const rendimentoBrutoTotal = rendimentos.reduce(
      (total, r) => total + Number(r.valorBruto),
      0,
    );
    const deducoesDetalhadasTotal =
      deducoes.reduce((total, d) => total + Number(d.valor), 0) +
      livroCaixaLancamentos.reduce((total, l) => total + Number(l.valor), 0);

    const deducoesTotal = Math.max(deducoesDetalhadasTotal, parametro.descontoSimplificadoMensal);
    const baseCalculo = Math.max(0, rendimentoBrutoTotal - deducoesTotal);

    let impostoDevido = 0;
    let calculoIncerto = false;

    if (baseCalculo > parametro.faixaIsencaoMensal) {
      const faixa =
        parametro.tabelaProgressivaMensal.find((f: FaixaProgressiva) => baseCalculo <= f.ate) ??
        parametro.tabelaProgressivaMensal[parametro.tabelaProgressivaMensal.length - 1];
      impostoDevido = Math.max(0, baseCalculo * faixa.aliquota - faixa.parcelaDeduzir);
      calculoIncerto = baseCalculo <= parametro.faixaReducaoAte;
    }

    const aliquotaEfetiva = baseCalculo > 0 ? impostoDevido / baseCalculo : 0;
    const vencimento = this.calcularVencimento(inicioMes);

    const apuracao = await this.prisma.apuracaoMensalCarneLeao.upsert({
      where: { usuarioId_competencia: { usuarioId, competencia: inicioMes } },
      create: {
        usuarioId,
        competencia: inicioMes,
        rendimentoBrutoTotal,
        deducoesTotal,
        baseCalculo,
        aliquotaEfetiva,
        impostoDevido,
        vencimento,
        calculoIncerto,
        status: StatusApuracao.PENDENTE,
      },
      update: {
        rendimentoBrutoTotal,
        deducoesTotal,
        baseCalculo,
        aliquotaEfetiva,
        impostoDevido,
        vencimento,
        calculoIncerto,
      },
    });

    return this.toResult(apuracao);
  }

  async buscarPorMes(
    usuarioId: string,
    ano: number,
    mes: number,
  ): Promise<ApuracaoCarneLeaoResult | null> {
    if (mes < 1 || mes > 12) {
      throw new BadRequestException('mes deve estar entre 1 e 12');
    }
    const competencia = new Date(Date.UTC(ano, mes - 1, 1));
    const apuracao = await this.prisma.apuracaoMensalCarneLeao.findUnique({
      where: { usuarioId_competencia: { usuarioId, competencia } },
    });
    return apuracao ? this.toResult(apuracao) : null;
  }

  private calcularVencimento(competencia: Date): Date {
    const ano = competencia.getUTCFullYear();
    const mes = competencia.getUTCMonth();
    const vencimento = new Date(Date.UTC(ano, mes + 2, 0)); // último dia do mês seguinte
    const diaSemana = vencimento.getUTCDay(); // 0=domingo .. 6=sábado
    if (diaSemana === 0) {
      vencimento.setUTCDate(vencimento.getUTCDate() - 2);
    } else if (diaSemana === 6) {
      vencimento.setUTCDate(vencimento.getUTCDate() - 1);
    }
    return vencimento;
  }

  private toResult(apuracao: RawApuracao): ApuracaoCarneLeaoResult {
    return {
      id: apuracao.id,
      competencia: apuracao.competencia,
      rendimentoBrutoTotal: Number(apuracao.rendimentoBrutoTotal),
      deducoesTotal: Number(apuracao.deducoesTotal),
      baseCalculo: Number(apuracao.baseCalculo),
      aliquotaEfetiva: Number(apuracao.aliquotaEfetiva),
      impostoDevido: Number(apuracao.impostoDevido),
      codigoReceita: apuracao.codigoReceita,
      vencimento: apuracao.vencimento,
      status: apuracao.status,
      calculoIncerto: apuracao.calculoIncerto,
    };
  }
}
