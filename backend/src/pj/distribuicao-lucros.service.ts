import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmpresaService } from './empresa.service';
import { ParametroFiscalPjService } from './parametro-fiscal-pj.service';
import { CreateDistribuicaoLucrosDto } from './dto/create-distribuicao-lucros.dto';
import { UpdateDistribuicaoLucrosDto } from './dto/update-distribuicao-lucros.dto';

export interface DistribuicaoLucrosResult {
  id: string;
  empresaId: string;
  competencia: Date;
  valor: number;
  isento: boolean;
  impostoRetido: number;
}

interface RawDistribuicaoLucros {
  id: string;
  empresaId: string;
  competencia: Date;
  valor: unknown;
  isento: boolean;
  impostoRetido: unknown;
}

@Injectable()
export class DistribuicaoLucrosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly empresaService: EmpresaService,
    private readonly parametroFiscalPjService: ParametroFiscalPjService,
  ) {}

  async create(
    usuarioId: string,
    dto: CreateDistribuicaoLucrosDto,
  ): Promise<DistribuicaoLucrosResult> {
    await this.empresaService.findOwned(usuarioId, dto.empresaId);
    const competencia = this.inicioMes(dto.competencia);
    const isento = await this.calcularIsento(dto.valor, competencia);

    const distribuicao = await this.prisma.distribuicaoLucros.create({
      data: {
        empresaId: dto.empresaId,
        competencia,
        valor: dto.valor,
        isento,
        impostoRetido: 0,
      },
    });

    return {
      id: distribuicao?.id,
      empresaId: dto.empresaId,
      competencia,
      valor: dto.valor,
      isento,
      impostoRetido: 0,
    };
  }

  async findByMonth(
    usuarioId: string,
    empresaId: string,
    ano: number,
    mes: number,
  ): Promise<DistribuicaoLucrosResult[]> {
    await this.empresaService.findOwned(usuarioId, empresaId);
    if (mes < 1 || mes > 12) {
      throw new BadRequestException('mes deve estar entre 1 e 12');
    }
    const competencia = new Date(Date.UTC(ano, mes - 1, 1));
    const distribuicoes = await this.prisma.distribuicaoLucros.findMany({
      where: { empresaId, competencia },
    });
    return distribuicoes.map((d) => this.toResult(d));
  }

  async update(
    usuarioId: string,
    id: string,
    dto: UpdateDistribuicaoLucrosDto,
  ): Promise<DistribuicaoLucrosResult> {
    const existente = await this.findOwned(usuarioId, id);
    const novoValor = dto.valor !== undefined ? dto.valor : Number(existente.valor);
    const novaCompetencia =
      dto.competencia !== undefined ? this.inicioMes(dto.competencia) : existente.competencia;
    const isento = await this.calcularIsento(novoValor, novaCompetencia);

    const distribuicao = await this.prisma.distribuicaoLucros.update({
      where: { id },
      data: {
        ...(dto.valor !== undefined && { valor: dto.valor }),
        ...(dto.competencia !== undefined && { competencia: novaCompetencia }),
        isento,
      },
    });

    return {
      id: distribuicao?.id ?? id,
      empresaId: existente.empresaId,
      competencia: novaCompetencia,
      valor: novoValor,
      isento,
      impostoRetido: 0,
    };
  }

  async delete(usuarioId: string, id: string): Promise<void> {
    await this.findOwned(usuarioId, id);
    await this.prisma.distribuicaoLucros.delete({ where: { id } });
  }

  private async findOwned(usuarioId: string, id: string): Promise<RawDistribuicaoLucros> {
    const distribuicao = await this.prisma.distribuicaoLucros.findUnique({
      where: { id },
      include: { empresa: true },
    });
    if (!distribuicao || distribuicao.empresa.usuarioId !== usuarioId) {
      throw new NotFoundException('distribuição de lucros não encontrada');
    }
    return distribuicao;
  }

  private async calcularIsento(valor: number, competencia: Date): Promise<boolean> {
    const parametro = await this.parametroFiscalPjService.buscarPorAno(
      competencia.getUTCFullYear(),
    );
    return valor <= parametro.limiteDividendoIsentoMensal;
  }

  private inicioMes(data: string): Date {
    const d = new Date(data);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }

  private toResult(distribuicao: RawDistribuicaoLucros): DistribuicaoLucrosResult {
    return {
      id: distribuicao.id,
      empresaId: distribuicao.empresaId,
      competencia: distribuicao.competencia,
      valor: Number(distribuicao.valor),
      isento: distribuicao.isento,
      impostoRetido: Number(distribuicao.impostoRetido),
    };
  }
}
