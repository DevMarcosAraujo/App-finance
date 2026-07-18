import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';
import { CreateLivroCaixaDto } from './dto/create-livro-caixa.dto';
import { UpdateLivroCaixaDto } from './dto/update-livro-caixa.dto';

export interface LivroCaixaResult {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  competencia: Date;
}

interface RawLivroCaixa {
  id: string;
  descricao: string;
  categoria: string;
  valor: unknown;
  competencia: Date;
  usuarioId: string;
}

@Injectable()
export class LivroCaixaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apuracaoService: ApuracaoCarneLeaoService,
  ) {}

  async create(usuarioId: string, dto: CreateLivroCaixaDto): Promise<LivroCaixaResult> {
    const competencia = this.inicioMes(dto.competencia);
    const lancamento = await this.prisma.livroCaixaLancamento.create({
      data: {
        usuarioId,
        descricao: dto.descricao,
        categoria: dto.categoria,
        valor: dto.valor,
        competencia,
      },
    });
    await this.apuracaoService.recalcular(usuarioId, competencia);
    return this.toResult(lancamento);
  }

  async findByMonth(usuarioId: string, ano: number, mes: number): Promise<LivroCaixaResult[]> {
    if (mes < 1 || mes > 12) {
      throw new BadRequestException('mes deve estar entre 1 e 12');
    }
    const competencia = new Date(Date.UTC(ano, mes - 1, 1));
    const lancamentos = await this.prisma.livroCaixaLancamento.findMany({
      where: { usuarioId, competencia },
    });
    return lancamentos.map((l) => this.toResult(l));
  }

  async update(
    usuarioId: string,
    id: string,
    dto: UpdateLivroCaixaDto,
  ): Promise<LivroCaixaResult> {
    const existente = await this.findOwned(usuarioId, id);

    const lancamento = await this.prisma.livroCaixaLancamento.update({
      where: { id },
      data: {
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.categoria !== undefined && { categoria: dto.categoria }),
        ...(dto.valor !== undefined && { valor: dto.valor }),
        ...(dto.competencia !== undefined && { competencia: this.inicioMes(dto.competencia) }),
      },
    });

    await this.apuracaoService.recalcular(usuarioId, existente.competencia);
    if (dto.competencia !== undefined) {
      const novaCompetencia = this.inicioMes(dto.competencia);
      if (novaCompetencia.getTime() !== existente.competencia.getTime()) {
        await this.apuracaoService.recalcular(usuarioId, novaCompetencia);
      }
    }

    return this.toResult(lancamento);
  }

  async delete(usuarioId: string, id: string): Promise<void> {
    const existente = await this.findOwned(usuarioId, id);
    await this.prisma.livroCaixaLancamento.delete({ where: { id } });
    await this.apuracaoService.recalcular(usuarioId, existente.competencia);
  }

  private async findOwned(
    usuarioId: string,
    id: string,
  ): Promise<{ id: string; usuarioId: string; competencia: Date }> {
    const lancamento = await this.prisma.livroCaixaLancamento.findUnique({ where: { id } });
    if (!lancamento || lancamento.usuarioId !== usuarioId) {
      throw new NotFoundException('lançamento de livro-caixa não encontrado');
    }
    return lancamento;
  }

  private inicioMes(data: string): Date {
    const d = new Date(data);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }

  private toResult(lancamento: RawLivroCaixa): LivroCaixaResult {
    return {
      id: lancamento.id,
      descricao: lancamento.descricao,
      categoria: lancamento.categoria,
      valor: Number(lancamento.valor),
      competencia: lancamento.competencia,
    };
  }
}
