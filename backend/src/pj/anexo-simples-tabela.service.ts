import { Injectable, NotFoundException } from '@nestjs/common';
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
}
