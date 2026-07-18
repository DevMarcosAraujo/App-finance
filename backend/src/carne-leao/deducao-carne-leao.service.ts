import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';
import { CreateDeducaoCarneLeaoDto, TipoDeducaoCarneLeaoAceito } from './dto/create-deducao-carne-leao.dto';
import { UpdateDeducaoCarneLeaoDto } from './dto/update-deducao-carne-leao.dto';

export interface DeducaoCarneLeaoResult {
  id: string;
  tipo: TipoDeducaoCarneLeaoAceito;
  valor: number;
  anexoUrl: string | null;
  competencia: Date;
}

interface RawDeducao {
  id: string;
  tipo: string;
  valor: unknown;
  anexoUrl: string | null;
  competencia: Date;
  usuarioId: string;
}

@Injectable()
export class DeducaoCarneLeaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apuracaoService: ApuracaoCarneLeaoService,
  ) {}

  async create(usuarioId: string, dto: CreateDeducaoCarneLeaoDto): Promise<DeducaoCarneLeaoResult> {
    const competencia = this.inicioMes(dto.competencia);
    const deducao = await this.prisma.deducaoCarneLeao.create({
      data: {
        usuarioId,
        tipo: dto.tipo,
        valor: dto.valor,
        anexoUrl: dto.anexoUrl,
        competencia,
      },
    });
    await this.apuracaoService.recalcular(usuarioId, competencia);
    return this.toResult(deducao);
  }

  async findByMonth(usuarioId: string, ano: number, mes: number): Promise<DeducaoCarneLeaoResult[]> {
    if (mes < 1 || mes > 12) {
      throw new BadRequestException('mes deve estar entre 1 e 12');
    }
    const competencia = new Date(Date.UTC(ano, mes - 1, 1));
    const deducoes = await this.prisma.deducaoCarneLeao.findMany({
      where: { usuarioId, competencia },
    });
    return deducoes.map((d) => this.toResult(d));
  }

  async update(
    usuarioId: string,
    id: string,
    dto: UpdateDeducaoCarneLeaoDto,
  ): Promise<DeducaoCarneLeaoResult> {
    const existente = await this.findOwned(usuarioId, id);

    const deducao = await this.prisma.deducaoCarneLeao.update({
      where: { id },
      data: {
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        ...(dto.valor !== undefined && { valor: dto.valor }),
        ...(dto.anexoUrl !== undefined && { anexoUrl: dto.anexoUrl }),
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

    return this.toResult(deducao);
  }

  async delete(usuarioId: string, id: string): Promise<void> {
    const existente = await this.findOwned(usuarioId, id);
    await this.prisma.deducaoCarneLeao.delete({ where: { id } });
    await this.apuracaoService.recalcular(usuarioId, existente.competencia);
  }

  private async findOwned(
    usuarioId: string,
    id: string,
  ): Promise<{ id: string; usuarioId: string; competencia: Date }> {
    const deducao = await this.prisma.deducaoCarneLeao.findUnique({ where: { id } });
    if (!deducao || deducao.usuarioId !== usuarioId) {
      throw new NotFoundException('dedução não encontrada');
    }
    return deducao;
  }

  private inicioMes(data: string): Date {
    const d = new Date(data);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }

  private toResult(deducao: RawDeducao): DeducaoCarneLeaoResult {
    return {
      id: deducao.id,
      tipo: deducao.tipo as TipoDeducaoCarneLeaoAceito,
      valor: Number(deducao.valor),
      anexoUrl: deducao.anexoUrl,
      competencia: deducao.competencia,
    };
  }
}
