import { Injectable } from '@nestjs/common';
import { TransacaoTipo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RelatorioAgregadoCategoria {
  categoriaId: string | null;
  categoriaNome: string;
  totalReceitas: number;
  totalDespesas: number;
}

export interface RelatorioAgregado {
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
  porCategoria: RelatorioAgregadoCategoria[];
}

interface RawTransacaoAgregacao {
  tipo: TransacaoTipo;
  valor: unknown;
  categoriaId: string | null;
  categoria: { id: string; nome: string } | null;
}

@Injectable()
export class RelatorioService {
  constructor(private readonly prisma: PrismaService) {}

  async agregar(
    workspaceId: string,
    periodoInicio: Date,
    periodoFim: Date,
  ): Promise<RelatorioAgregado> {
    const transacoes = await this.prisma.transacao.findMany({
      where: { workspaceId, data: { gte: periodoInicio, lt: periodoFim } },
      include: { categoria: true },
    });

    const porCategoriaMap = new Map<string, RelatorioAgregadoCategoria>();
    let totalReceitas = 0;
    let totalDespesas = 0;

    for (const transacao of transacoes as RawTransacaoAgregacao[]) {
      const valor = Number(transacao.valor);
      const chave = transacao.categoriaId ?? 'sem-categoria';
      const nome = transacao.categoria?.nome ?? 'Sem categoria';

      if (!porCategoriaMap.has(chave)) {
        porCategoriaMap.set(chave, {
          categoriaId: transacao.categoriaId,
          categoriaNome: nome,
          totalReceitas: 0,
          totalDespesas: 0,
        });
      }
      const entry = porCategoriaMap.get(chave)!;

      if (transacao.tipo === TransacaoTipo.RECEITA) {
        totalReceitas += valor;
        entry.totalReceitas += valor;
      } else {
        totalDespesas += valor;
        entry.totalDespesas += valor;
      }
    }

    return {
      totalReceitas,
      totalDespesas,
      saldo: totalReceitas - totalDespesas,
      porCategoria: Array.from(porCategoriaMap.values()),
    };
  }
}
