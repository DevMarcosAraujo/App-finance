import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TransacaoTipo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransacaoDto } from './dto/create-transacao.dto';
import { UpdateTransacaoDto } from './dto/update-transacao.dto';

export interface TransacaoResult {
  id: string;
  tipo: TransacaoTipo;
  valor: number;
  categoria: {
    id: string;
    nome: string;
    cor: string | null;
    icone: string | null;
  } | null;
  descricao: string | null;
  data: Date;
  usuarioId: string;
}

interface RawTransacao {
  id: string;
  tipo: TransacaoTipo;
  valor: unknown;
  categoria: {
    id: string;
    nome: string;
    cor: string | null;
    icone: string | null;
  } | null;
  descricao: string | null;
  data: Date;
  usuarioId: string;
}

@Injectable()
export class TransacaoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    workspaceId: string,
    usuarioId: string,
    dto: CreateTransacaoDto,
  ): Promise<TransacaoResult> {
    if (dto.categoriaId) {
      await this.assertCategoriaExists(dto.categoriaId);
    }

    const transacao = await this.prisma.transacao.create({
      data: {
        workspaceId,
        usuarioId,
        tipo: dto.tipo,
        valor: dto.valor,
        categoriaId: dto.categoriaId,
        descricao: dto.descricao,
        data: new Date(dto.data),
      },
      include: { categoria: true },
    });

    return this.toResult(transacao);
  }

  async findByMonth(
    workspaceId: string,
    ano: number,
    mes: number,
  ): Promise<TransacaoResult[]> {
    if (mes < 1 || mes > 12) {
      throw new BadRequestException('mes deve estar entre 1 e 12');
    }

    const inicio = new Date(Date.UTC(ano, mes - 1, 1));
    const fim = new Date(
      Date.UTC(mes === 12 ? ano + 1 : ano, mes === 12 ? 0 : mes, 1),
    );

    const transacoes = await this.prisma.transacao.findMany({
      where: { workspaceId, data: { gte: inicio, lt: fim } },
      orderBy: { data: 'desc' },
      include: { categoria: true },
    });

    return transacoes.map((transacao) => this.toResult(transacao));
  }

  async update(
    workspaceId: string,
    id: string,
    dto: UpdateTransacaoDto,
  ): Promise<TransacaoResult> {
    await this.findOwned(workspaceId, id);

    if (dto.categoriaId) {
      await this.assertCategoriaExists(dto.categoriaId);
    }

    const transacao = await this.prisma.transacao.update({
      where: { id },
      data: {
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        ...(dto.valor !== undefined && { valor: dto.valor }),
        ...(dto.categoriaId !== undefined && { categoriaId: dto.categoriaId }),
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.data !== undefined && { data: new Date(dto.data) }),
      },
      include: { categoria: true },
    });

    return this.toResult(transacao);
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    await this.findOwned(workspaceId, id);
    await this.prisma.transacao.delete({ where: { id } });
  }

  private async findOwned(
    workspaceId: string,
    id: string,
  ): Promise<{ id: string; workspaceId: string }> {
    const transacao = await this.prisma.transacao.findUnique({
      where: { id },
    });
    if (!transacao || transacao.workspaceId !== workspaceId) {
      throw new NotFoundException('transação não encontrada');
    }
    return transacao;
  }

  private async assertCategoriaExists(categoriaId: string): Promise<void> {
    const categoria = await this.prisma.categoria.findUnique({
      where: { id: categoriaId },
    });
    if (!categoria) {
      throw new BadRequestException('categoria não encontrada');
    }
  }

  private toResult(transacao: RawTransacao): TransacaoResult {
    return {
      id: transacao.id,
      tipo: transacao.tipo,
      valor: Number(transacao.valor),
      categoria: transacao.categoria,
      descricao: transacao.descricao,
      data: transacao.data,
      usuarioId: transacao.usuarioId,
    };
  }
}
