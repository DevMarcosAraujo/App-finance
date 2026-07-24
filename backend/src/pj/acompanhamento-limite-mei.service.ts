import { Injectable, NotFoundException } from '@nestjs/common';
import { RegimeEmpresa } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ParametroFiscalPjService } from './parametro-fiscal-pj.service';

export type AlertaLimiteMei = 'ok' | 'atencao_80pct' | 'excedeu_20pct' | 'excedeu_mais_20pct';

export interface AcompanhamentoLimiteMeiResult {
  id: string;
  anoCalendario: number;
  limiteProporcional: number;
  receitaAcumuladaAno: number;
  percentualAtingido: number;
  alerta: AlertaLimiteMei;
}

interface RawAcompanhamento {
  id: string;
  anoCalendario: number;
  limiteProporcional: unknown;
  receitaAcumuladaAno: unknown;
  percentualAtingido: unknown;
  alerta: string;
}

@Injectable()
export class AcompanhamentoLimiteMeiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametroFiscalPjService: ParametroFiscalPjService,
  ) {}

  async recalcular(
    empresaId: string,
    anoCalendario: number,
  ): Promise<AcompanhamentoLimiteMeiResult | null> {
    const empresa = await this.prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } });
    if (empresa.regime !== RegimeEmpresa.MEI) {
      return null;
    }

    const parametro = await this.parametroFiscalPjService.buscarPorAno(anoCalendario);
    const mesesAtividade = this.contarMesesAtividadeNoAno(empresa.dataAbertura, anoCalendario);
    const limiteProporcional = (parametro.meiLimiteAnual / 12) * mesesAtividade;

    const inicioAno = new Date(Date.UTC(anoCalendario, 0, 1));
    const fimAno = new Date(Date.UTC(anoCalendario, 11, 31));
    const faturamentos = await this.prisma.faturamentoMensalPJ.findMany({
      where: { empresaId, competencia: { gte: inicioAno, lte: fimAno } },
    });
    const receitaAcumuladaAno = faturamentos.reduce(
      (total, f) => total + Number(f.receitaBrutaTotal),
      0,
    );

    const percentualAtingido = limiteProporcional > 0 ? receitaAcumuladaAno / limiteProporcional : 0;
    const alerta = this.calcularAlerta(percentualAtingido);

    const registro = await this.prisma.acompanhamentoLimiteMEI.upsert({
      where: { empresaId_anoCalendario: { empresaId, anoCalendario } },
      create: {
        empresaId,
        anoCalendario,
        limiteProporcional,
        receitaAcumuladaAno,
        percentualAtingido,
        alerta,
      },
      update: { limiteProporcional, receitaAcumuladaAno, percentualAtingido, alerta },
    });

    return this.toResult(registro);
  }

  async buscarPorAno(
    empresaId: string,
    anoCalendario: number,
  ): Promise<AcompanhamentoLimiteMeiResult | null> {
    const empresa = await this.prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } });
    if (empresa.regime !== RegimeEmpresa.MEI) {
      throw new NotFoundException('acompanhamento de limite só existe para empresas MEI');
    }
    const registro = await this.prisma.acompanhamentoLimiteMEI.findUnique({
      where: { empresaId_anoCalendario: { empresaId, anoCalendario } },
    });
    return registro ? this.toResult(registro) : null;
  }

  private contarMesesAtividadeNoAno(dataAbertura: Date, anoCalendario: number): number {
    const anoAbertura = dataAbertura.getUTCFullYear();
    if (anoAbertura > anoCalendario) {
      return 0;
    }
    const mesInicio = anoAbertura === anoCalendario ? dataAbertura.getUTCMonth() : 0;
    return 12 - mesInicio;
  }

  private calcularAlerta(percentual: number): AlertaLimiteMei {
    if (percentual > 1.2) return 'excedeu_mais_20pct';
    if (percentual > 1) return 'excedeu_20pct';
    if (percentual >= 0.8) return 'atencao_80pct';
    return 'ok';
  }

  private toResult(registro: RawAcompanhamento): AcompanhamentoLimiteMeiResult {
    return {
      id: registro.id,
      anoCalendario: registro.anoCalendario,
      limiteProporcional: Number(registro.limiteProporcional),
      receitaAcumuladaAno: Number(registro.receitaAcumuladaAno),
      percentualAtingido: Number(registro.percentualAtingido),
      alerta: registro.alerta as AlertaLimiteMei,
    };
  }
}
