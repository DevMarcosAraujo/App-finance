import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { TipoRendimentoAutonomo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';
import { CreateRendimentoAutonomoDto } from './dto/create-rendimento-autonomo.dto';
import { UpdateRendimentoAutonomoDto } from './dto/update-rendimento-autonomo.dto';

export interface RendimentoAutonomoResult {
  id: string;
  tipo: TipoRendimentoAutonomo;
  fontePagadoraCpf: string | null;
  valorBruto: number;
  documentoFiscalId: string | null;
  competencia: Date;
}

interface RawRendimento {
  id: string;
  tipo: TipoRendimentoAutonomo;
  fontePagadoraCpf: string | null;
  valorBruto: unknown;
  documentoFiscalId: string | null;
  competencia: Date;
  usuarioId: string;
}

@Injectable()
export class RendimentoAutonomoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apuracaoService: ApuracaoCarneLeaoService,
  ) {}

  async create(
    usuarioId: string,
    dto: CreateRendimentoAutonomoDto,
  ): Promise<RendimentoAutonomoResult> {
    const competencia = this.inicioMes(dto.competencia);
    const rendimento = await this.prisma.rendimentoAutonomo.create({
      data: {
        usuarioId,
        tipo: dto.tipo,
        fontePagadoraCpf: dto.fontePagadoraCpf,
        valorBruto: dto.valorBruto,
        documentoFiscalId: dto.documentoFiscalId,
        competencia,
      },
    });
    await this.apuracaoService.recalcular(usuarioId, competencia);
    return this.toResult(rendimento);
  }

  async findByMonth(
    usuarioId: string,
    ano: number,
    mes: number,
  ): Promise<RendimentoAutonomoResult[]> {
    if (mes < 1 || mes > 12) {
      throw new BadRequestException('mes deve estar entre 1 e 12');
    }
    const competencia = new Date(Date.UTC(ano, mes - 1, 1));
    const rendimentos = await this.prisma.rendimentoAutonomo.findMany({
      where: { usuarioId, competencia },
    });
    return rendimentos.map((r) => this.toResult(r));
  }

  async update(
    usuarioId: string,
    id: string,
    dto: UpdateRendimentoAutonomoDto,
  ): Promise<RendimentoAutonomoResult> {
    const existente = await this.findOwned(usuarioId, id);

    const rendimento = await this.prisma.rendimentoAutonomo.update({
      where: { id },
      data: {
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        ...(dto.fontePagadoraCpf !== undefined && { fontePagadoraCpf: dto.fontePagadoraCpf }),
        ...(dto.valorBruto !== undefined && { valorBruto: dto.valorBruto }),
        ...(dto.documentoFiscalId !== undefined && { documentoFiscalId: dto.documentoFiscalId }),
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

    return this.toResult(rendimento);
  }

  async delete(usuarioId: string, id: string): Promise<void> {
    const existente = await this.findOwned(usuarioId, id);
    await this.prisma.rendimentoAutonomo.delete({ where: { id } });
    await this.apuracaoService.recalcular(usuarioId, existente.competencia);
  }

  private async findOwned(
    usuarioId: string,
    id: string,
  ): Promise<{ id: string; usuarioId: string; competencia: Date }> {
    const rendimento = await this.prisma.rendimentoAutonomo.findUnique({ where: { id } });
    if (!rendimento || rendimento.usuarioId !== usuarioId) {
      throw new NotFoundException('rendimento não encontrado');
    }
    return rendimento;
  }

  private inicioMes(data: string): Date {
    const d = new Date(data);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }

  private toResult(rendimento: RawRendimento): RendimentoAutonomoResult {
    return {
      id: rendimento.id,
      tipo: rendimento.tipo,
      fontePagadoraCpf: rendimento.fontePagadoraCpf,
      valorBruto: Number(rendimento.valorBruto),
      documentoFiscalId: rendimento.documentoFiscalId,
      competencia: rendimento.competencia,
    };
  }
}
