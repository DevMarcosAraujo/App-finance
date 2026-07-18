import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface FaixaProgressiva {
  ate: number;
  aliquota: number;
  parcelaDeduzir: number;
}

export interface ParametroFiscalPfDados {
  faixaIsencaoMensal: number;
  faixaReducaoAte: number;
  tetoEducacaoAnual: number;
  valorDependenteMensal: number;
  descontoSimplificadoMensal: number;
  limiteObrigatoriedadeDeclaracao: number;
  tabelaProgressivaMensal: FaixaProgressiva[];
}

export interface ParametroFiscalPfResult extends ParametroFiscalPfDados {
  anoCalendario: number;
}

interface RawParametroFiscalPf {
  anoCalendario: number;
  faixaIsencaoMensal: unknown;
  faixaReducaoAte: unknown;
  tetoEducacaoAnual: unknown;
  valorDependenteMensal: unknown;
  descontoSimplificadoMensal: unknown;
  limiteObrigatoriedadeDeclaracao: unknown;
  tabelaProgressivaMensal: unknown;
}

@Injectable()
export class ParametroFiscalPfService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureSeed(ano: number, dados: ParametroFiscalPfDados): Promise<void> {
    const existente = await this.prisma.parametroFiscalPF.findUnique({
      where: { anoCalendario: ano },
    });
    if (existente) {
      return;
    }
    await this.prisma.parametroFiscalPF.create({
      data: { anoCalendario: ano, ...dados },
    });
  }

  async buscarPorAno(ano: number): Promise<ParametroFiscalPfResult> {
    const parametro = await this.prisma.parametroFiscalPF.findUnique({
      where: { anoCalendario: ano },
    });
    if (!parametro) {
      throw new NotFoundException(`parâmetro fiscal do ano ${ano} não cadastrado`);
    }
    return this.toResult(parametro);
  }

  private toResult(parametro: RawParametroFiscalPf): ParametroFiscalPfResult {
    return {
      anoCalendario: parametro.anoCalendario,
      faixaIsencaoMensal: Number(parametro.faixaIsencaoMensal),
      faixaReducaoAte: Number(parametro.faixaReducaoAte),
      tetoEducacaoAnual: Number(parametro.tetoEducacaoAnual),
      valorDependenteMensal: Number(parametro.valorDependenteMensal),
      descontoSimplificadoMensal: Number(parametro.descontoSimplificadoMensal),
      limiteObrigatoriedadeDeclaracao: Number(parametro.limiteObrigatoriedadeDeclaracao),
      tabelaProgressivaMensal: parametro.tabelaProgressivaMensal as unknown as FaixaProgressiva[],
    };
  }
}
