import { Injectable, NotFoundException } from '@nestjs/common';
import { TransacaoTipo, TipoRelatorio } from '@prisma/client';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { renderRelatorioPdf } from './relatorio.pdf';

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

export interface GerarRelatorioInput {
  tipo: TipoRelatorio;
  periodoInicio: Date;
  periodoFim: Date;
}

export interface RelatorioGeradoResult {
  id: string;
  tipo: TipoRelatorio;
  periodoInicio: Date;
  periodoFim: Date;
  arquivoPdfUrl: string;
  geradoEm: Date;
}

interface RawRelatorioGerado {
  id: string;
  tipo: TipoRelatorio;
  periodoInicio: Date;
  periodoFim: Date;
  arquivoPdfUrl: string;
  geradoEm: Date;
}

@Injectable()
export class RelatorioService {
  private readonly storageDir = path.join(process.cwd(), 'storage', 'relatorios');

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

  async gerar(
    workspaceId: string,
    input: GerarRelatorioInput,
  ): Promise<RelatorioGeradoResult> {
    const agregado = await this.agregar(
      workspaceId,
      input.periodoInicio,
      input.periodoFim,
    );
    const buffer = await renderRelatorioPdf({
      tipo: input.tipo,
      periodoInicio: input.periodoInicio,
      periodoFim: input.periodoFim,
      agregado,
    });

    // Cria o registro primeiro (sem arquivoPdfUrl) porque a URL pública usa o
    // id do registro, não um identificador gerado à parte — evita manter dois
    // ids diferentes (arquivo em disco x registro) para a mesma entidade.
    const relatorio = await this.prisma.relatorioGerado.create({
      data: {
        workspaceId,
        tipo: input.tipo,
        periodoInicio: input.periodoInicio,
        periodoFim: input.periodoFim,
        arquivoPdfUrl: '',
      },
    });

    const workspaceDir = path.join(this.storageDir, workspaceId);
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.writeFile(path.join(workspaceDir, `${relatorio.id}.pdf`), buffer);

    const atualizado = await this.prisma.relatorioGerado.update({
      where: { id: relatorio.id },
      data: { arquivoPdfUrl: `/relatorios/${relatorio.id}/arquivo` },
    });

    return this.toRelatorioResult(atualizado);
  }

  async listar(workspaceId: string): Promise<RelatorioGeradoResult[]> {
    const relatorios = await this.prisma.relatorioGerado.findMany({
      where: { workspaceId },
      orderBy: { geradoEm: 'desc' },
    });
    return relatorios.map((relatorio) => this.toRelatorioResult(relatorio));
  }

  async buscarArquivo(workspaceId: string, id: string): Promise<Buffer> {
    const relatorio = await this.prisma.relatorioGerado.findUnique({
      where: { id },
    });
    if (!relatorio || relatorio.workspaceId !== workspaceId) {
      throw new NotFoundException('relatório não encontrado');
    }

    const caminho = path.join(this.storageDir, workspaceId, `${relatorio.id}.pdf`);
    return fs.readFile(caminho);
  }

  private toRelatorioResult(relatorio: RawRelatorioGerado): RelatorioGeradoResult {
    return {
      id: relatorio.id,
      tipo: relatorio.tipo,
      periodoInicio: relatorio.periodoInicio,
      periodoFim: relatorio.periodoFim,
      arquivoPdfUrl: relatorio.arquivoPdfUrl,
      geradoEm: relatorio.geradoEm,
    };
  }
}
