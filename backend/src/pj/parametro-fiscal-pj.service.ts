import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ParametroFiscalPjDados {
  meiLimiteAnual: number;
  meiDasComercioIndustria: number;
  meiDasServicos: number;
  meiDasComercioServicos: number;
  limiteDividendoIsentoMensal: number;
  aliquotaDividendoExcedente: number;
}

export interface ParametroFiscalPjResult extends ParametroFiscalPjDados {
  anoCalendario: number;
}

interface RawParametroFiscalPj {
  anoCalendario: number;
  meiLimiteAnual: unknown;
  meiDasComercioIndustria: unknown;
  meiDasServicos: unknown;
  meiDasComercioServicos: unknown;
  limiteDividendoIsentoMensal: unknown;
  aliquotaDividendoExcedente: unknown;
}

@Injectable()
export class ParametroFiscalPjService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureSeed(ano: number, dados: ParametroFiscalPjDados): Promise<void> {
    const existente = await this.prisma.parametroFiscalPJ.findUnique({
      where: { anoCalendario: ano },
    });
    if (existente) {
      return;
    }
    await this.prisma.parametroFiscalPJ.create({
      data: { anoCalendario: ano, ...dados },
    });
  }

  async buscarPorAno(ano: number): Promise<ParametroFiscalPjResult> {
    const parametro = await this.prisma.parametroFiscalPJ.findUnique({
      where: { anoCalendario: ano },
    });
    if (!parametro) {
      throw new NotFoundException(`parâmetro fiscal PJ do ano ${ano} não cadastrado`);
    }
    return this.toResult(parametro);
  }

  private toResult(parametro: RawParametroFiscalPj): ParametroFiscalPjResult {
    return {
      anoCalendario: parametro.anoCalendario,
      meiLimiteAnual: Number(parametro.meiLimiteAnual),
      meiDasComercioIndustria: Number(parametro.meiDasComercioIndustria),
      meiDasServicos: Number(parametro.meiDasServicos),
      meiDasComercioServicos: Number(parametro.meiDasComercioServicos),
      limiteDividendoIsentoMensal: Number(parametro.limiteDividendoIsentoMensal),
      aliquotaDividendoExcedente: Number(parametro.aliquotaDividendoExcedente),
    };
  }
}
