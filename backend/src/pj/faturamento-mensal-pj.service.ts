import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EmissorTipo, RegimeEmpresa } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmpresaService } from './empresa.service';
import { RBT12Service } from './rbt12.service';
import { DASApuracaoService } from './das-apuracao.service';
import { AcompanhamentoLimiteMeiService } from './acompanhamento-limite-mei.service';
import { CreateFaturamentoMensalPjDto } from './dto/create-faturamento-mensal-pj.dto';
import { UpdateFaturamentoMensalPjDto } from './dto/update-faturamento-mensal-pj.dto';

export interface FaturamentoMensalPjResult {
  id: string;
  empresaId: string;
  competencia: Date;
  receitaBrutaTotal: number;
  receitaComNota: number | null;
  receitaSemNota: number | null;
  clienteTipoPredominante: EmissorTipo | null;
}

interface RawFaturamento {
  id: string;
  empresaId: string;
  competencia: Date;
  receitaBrutaTotal: unknown;
  receitaComNota: unknown;
  receitaSemNota: unknown;
  clienteTipoPredominante: EmissorTipo | null;
}

@Injectable()
export class FaturamentoMensalPjService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly empresaService: EmpresaService,
    private readonly rbt12Service: RBT12Service,
    private readonly dasApuracaoService: DASApuracaoService,
    private readonly acompanhamentoLimiteMeiService: AcompanhamentoLimiteMeiService,
  ) {}

  async create(
    usuarioId: string,
    dto: CreateFaturamentoMensalPjDto,
  ): Promise<FaturamentoMensalPjResult> {
    await this.empresaService.findOwned(usuarioId, dto.empresaId);
    const competencia = this.inicioMes(dto.competencia);

    const faturamento = await this.prisma.faturamentoMensalPJ.upsert({
      where: { empresaId_competencia: { empresaId: dto.empresaId, competencia } },
      create: {
        empresaId: dto.empresaId,
        competencia,
        receitaBrutaTotal: dto.receitaBrutaTotal,
        receitaComNota: dto.receitaComNota,
        receitaSemNota: dto.receitaSemNota,
        clienteTipoPredominante: dto.clienteTipoPredominante,
      },
      update: {
        receitaBrutaTotal: dto.receitaBrutaTotal,
        receitaComNota: dto.receitaComNota,
        receitaSemNota: dto.receitaSemNota,
        clienteTipoPredominante: dto.clienteTipoPredominante,
      },
    });

    await this.recalcularCascata(dto.empresaId, competencia);
    return this.toResult(faturamento);
  }

  async findByMonth(
    usuarioId: string,
    empresaId: string,
    ano: number,
    mes: number,
  ): Promise<FaturamentoMensalPjResult[]> {
    await this.empresaService.findOwned(usuarioId, empresaId);
    if (mes < 1 || mes > 12) {
      throw new BadRequestException('mes deve estar entre 1 e 12');
    }
    const competencia = new Date(Date.UTC(ano, mes - 1, 1));
    const faturamento = await this.prisma.faturamentoMensalPJ.findUnique({
      where: { empresaId_competencia: { empresaId, competencia } },
    });
    return faturamento ? [this.toResult(faturamento)] : [];
  }

  async update(
    usuarioId: string,
    id: string,
    dto: UpdateFaturamentoMensalPjDto,
  ): Promise<FaturamentoMensalPjResult> {
    const existente = await this.findOwned(usuarioId, id);

    const faturamento = await this.prisma.faturamentoMensalPJ.update({
      where: { id },
      data: {
        ...(dto.receitaBrutaTotal !== undefined && { receitaBrutaTotal: dto.receitaBrutaTotal }),
        ...(dto.receitaComNota !== undefined && { receitaComNota: dto.receitaComNota }),
        ...(dto.receitaSemNota !== undefined && { receitaSemNota: dto.receitaSemNota }),
        ...(dto.clienteTipoPredominante !== undefined && {
          clienteTipoPredominante: dto.clienteTipoPredominante,
        }),
      },
    });

    await this.recalcularCascata(existente.empresaId, existente.competencia);
    return this.toResult(faturamento);
  }

  async delete(usuarioId: string, id: string): Promise<void> {
    const existente = await this.findOwned(usuarioId, id);
    await this.prisma.faturamentoMensalPJ.delete({ where: { id } });
    await this.recalcularCascata(existente.empresaId, existente.competencia);
  }

  private async findOwned(
    usuarioId: string,
    id: string,
  ): Promise<{ id: string; empresaId: string; competencia: Date }> {
    const faturamento = await this.prisma.faturamentoMensalPJ.findUnique({
      where: { id },
      include: { empresa: true },
    });
    if (!faturamento || faturamento.empresa.usuarioId !== usuarioId) {
      throw new NotFoundException('faturamento não encontrado');
    }
    return faturamento;
  }

  private async recalcularCascata(empresaId: string, competencia: Date): Promise<void> {
    const empresa = await this.prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } });
    if (empresa.regime === RegimeEmpresa.SIMPLES_ME) {
      await this.rbt12Service.recalcular(empresaId, competencia);
    }
    await this.dasApuracaoService.recalcular(empresaId, competencia);
    if (empresa.regime === RegimeEmpresa.MEI) {
      await this.acompanhamentoLimiteMeiService.recalcular(empresaId, competencia.getUTCFullYear());
    }
  }

  private inicioMes(data: string): Date {
    const d = new Date(data);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }

  private toResult(faturamento: RawFaturamento): FaturamentoMensalPjResult {
    return {
      id: faturamento.id,
      empresaId: faturamento.empresaId,
      competencia: faturamento.competencia,
      receitaBrutaTotal: Number(faturamento.receitaBrutaTotal),
      receitaComNota: faturamento.receitaComNota !== null ? Number(faturamento.receitaComNota) : null,
      receitaSemNota: faturamento.receitaSemNota !== null ? Number(faturamento.receitaSemNota) : null,
      clienteTipoPredominante: faturamento.clienteTipoPredominante,
    };
  }
}
