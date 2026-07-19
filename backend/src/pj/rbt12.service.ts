import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RBT12Result {
  id: string;
  empresaId: string;
  competencia: Date;
  rbt12Calculado: number;
}

interface RawRBT12 {
  id: string;
  empresaId: string;
  competencia: Date;
  rbt12Calculado: unknown;
}

@Injectable()
export class RBT12Service {
  constructor(private readonly prisma: PrismaService) {}

  async recalcular(empresaId: string, competencia: Date): Promise<RBT12Result> {
    const empresa = await this.prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } });
    const mesesAtividade = this.contarMesesAtividade(empresa.dataAbertura, competencia);

    let rbt12: number;
    if (mesesAtividade >= 12) {
      const inicioJanela = new Date(
        Date.UTC(competencia.getUTCFullYear(), competencia.getUTCMonth() - 11, 1),
      );
      rbt12 = await this.somarFaturamento(empresaId, inicioJanela, competencia);
    } else {
      const inicioAtividade = new Date(
        Date.UTC(empresa.dataAbertura.getUTCFullYear(), empresa.dataAbertura.getUTCMonth(), 1),
      );
      const somaDesdeAbertura = await this.somarFaturamento(empresaId, inicioAtividade, competencia);
      rbt12 = mesesAtividade > 0 ? (somaDesdeAbertura / mesesAtividade) * 12 : 0;
    }

    const registro = await this.prisma.rBT12Cache.upsert({
      where: { empresaId_competencia: { empresaId, competencia } },
      create: { empresaId, competencia, rbt12Calculado: rbt12 },
      update: { rbt12Calculado: rbt12 },
    });

    return this.toResult(registro);
  }

  private async somarFaturamento(empresaId: string, inicio: Date, fim: Date): Promise<number> {
    const faturamentos = await this.prisma.faturamentoMensalPJ.findMany({
      where: { empresaId, competencia: { gte: inicio, lte: fim } },
    });
    return faturamentos.reduce((total, f) => total + Number(f.receitaBrutaTotal), 0);
  }

  private contarMesesAtividade(dataAbertura: Date, competencia: Date): number {
    const anoInicio = dataAbertura.getUTCFullYear();
    const mesInicio = dataAbertura.getUTCMonth();
    const anoFim = competencia.getUTCFullYear();
    const mesFim = competencia.getUTCMonth();
    return (anoFim - anoInicio) * 12 + (mesFim - mesInicio) + 1;
  }

  private toResult(registro: RawRBT12): RBT12Result {
    return {
      id: registro.id,
      empresaId: registro.empresaId,
      competencia: registro.competencia,
      rbt12Calculado: Number(registro.rbt12Calculado),
    };
  }
}
