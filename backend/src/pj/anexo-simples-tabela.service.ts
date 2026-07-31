import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AnexoSimples, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface FaixaSimples {
  rbt12Ate: number;
  aliquota: number;
  parcelaDeduzir: number;
}

@Injectable()
export class AnexoSimplesTabelaService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureSeed(ano: number, anexo: AnexoSimples, faixas: FaixaSimples[]): Promise<void> {
    this.validarFaixas(faixas);
    const existente = await this.prisma.anexoSimplesTabela.findUnique({
      where: { anoCalendario_anexo: { anoCalendario: ano, anexo } },
    });
    if (existente) {
      return;
    }
    await this.prisma.anexoSimplesTabela.create({
      data: {
        anoCalendario: ano,
        anexo,
        faixas: faixas as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async buscarFaixas(ano: number, anexo: AnexoSimples): Promise<FaixaSimples[]> {
    const tabela = await this.prisma.anexoSimplesTabela.findUnique({
      where: { anoCalendario_anexo: { anoCalendario: ano, anexo } },
    });
    if (!tabela) {
      throw new NotFoundException(
        `tabela do Anexo ${anexo} do ano ${ano} não cadastrada`,
      );
    }
    return tabela.faixas as unknown as FaixaSimples[];
  }

  private validarFaixas(faixas: FaixaSimples[]): void {
    if (!Array.isArray(faixas) || faixas.length === 0) {
      throw new BadRequestException('faixas deve ser um array não vazio');
    }
    let rbt12AteAnterior = -Infinity;
    for (const faixa of faixas) {
      if (typeof faixa.rbt12Ate !== 'number' || faixa.rbt12Ate <= 0) {
        throw new BadRequestException('rbt12Ate deve ser um número positivo em todas as faixas');
      }
      if (typeof faixa.aliquota !== 'number' || faixa.aliquota < 0 || faixa.aliquota > 1) {
        throw new BadRequestException('aliquota deve ser um número entre 0 e 1 em todas as faixas');
      }
      if (typeof faixa.parcelaDeduzir !== 'number' || faixa.parcelaDeduzir < 0) {
        throw new BadRequestException(
          'parcelaDeduzir deve ser um número não negativo em todas as faixas',
        );
      }
      if (faixa.rbt12Ate <= rbt12AteAnterior) {
        throw new BadRequestException('faixas devem estar ordenadas de forma ascendente por rbt12Ate');
      }
      rbt12AteAnterior = faixa.rbt12Ate;
    }
  }
}
