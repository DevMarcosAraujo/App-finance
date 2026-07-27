import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmpresaService } from './empresa.service';
import {
  ParametroFiscalPfService,
  ParametroFiscalPfResult,
} from '../carne-leao/parametro-fiscal-pf.service';
import { CreateProLaboreDto } from './dto/create-pro-labore.dto';
import { UpdateProLaboreDto } from './dto/update-pro-labore.dto';

export interface ProLaboreResult {
  id: string;
  empresaId: string;
  competencia: Date;
  valor: number;
  inssRetido: number;
  irrfRetido: number;
}

interface RawProLabore {
  id: string;
  empresaId: string;
  competencia: Date;
  valor: unknown;
  inssRetido: unknown;
  irrfRetido: unknown;
}

@Injectable()
export class ProLaboreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly empresaService: EmpresaService,
    private readonly parametroFiscalPfService: ParametroFiscalPfService,
  ) {}

  async create(usuarioId: string, dto: CreateProLaboreDto): Promise<ProLaboreResult> {
    await this.empresaService.findOwned(usuarioId, dto.empresaId);
    const competencia = this.inicioMes(dto.competencia);
    const parametro = await this.parametroFiscalPfService.buscarPorAno(competencia.getUTCFullYear());
    const irrfRetido = this.calcularIrrf(dto.valor, parametro);

    const proLabore = await this.prisma.proLabore.create({
      data: {
        empresaId: dto.empresaId,
        competencia,
        valor: dto.valor,
        inssRetido: dto.inssRetido,
        irrfRetido,
      },
    });
    return {
      id: proLabore?.id,
      empresaId: dto.empresaId,
      competencia,
      valor: dto.valor,
      inssRetido: dto.inssRetido,
      irrfRetido,
    };
  }

  async findByMonth(
    usuarioId: string,
    empresaId: string,
    ano: number,
    mes: number,
  ): Promise<ProLaboreResult[]> {
    await this.empresaService.findOwned(usuarioId, empresaId);
    if (mes < 1 || mes > 12) {
      throw new BadRequestException('mes deve estar entre 1 e 12');
    }
    const competencia = new Date(Date.UTC(ano, mes - 1, 1));
    const proLabores = await this.prisma.proLabore.findMany({ where: { empresaId, competencia } });
    return proLabores.map((p) => this.toResult(p));
  }

  async update(usuarioId: string, id: string, dto: UpdateProLaboreDto): Promise<ProLaboreResult> {
    const existente = await this.findOwned(usuarioId, id);
    const novoValor = dto.valor !== undefined ? dto.valor : Number(existente.valor);
    const novaCompetencia =
      dto.competencia !== undefined ? this.inicioMes(dto.competencia) : existente.competencia;
    const parametro = await this.parametroFiscalPfService.buscarPorAno(
      novaCompetencia.getUTCFullYear(),
    );
    const irrfRetido = this.calcularIrrf(novoValor, parametro);

    const novoInssRetido = dto.inssRetido !== undefined ? dto.inssRetido : Number(existente.inssRetido);
    const proLabore = await this.prisma.proLabore.update({
      where: { id },
      data: {
        ...(dto.valor !== undefined && { valor: dto.valor }),
        ...(dto.inssRetido !== undefined && { inssRetido: dto.inssRetido }),
        ...(dto.competencia !== undefined && { competencia: novaCompetencia }),
        irrfRetido,
      },
    });
    return {
      id: proLabore?.id ?? id,
      empresaId: existente.empresaId,
      competencia: novaCompetencia,
      valor: novoValor,
      inssRetido: novoInssRetido,
      irrfRetido,
    };
  }

  async delete(usuarioId: string, id: string): Promise<void> {
    await this.findOwned(usuarioId, id);
    await this.prisma.proLabore.delete({ where: { id } });
  }

  private async findOwned(usuarioId: string, id: string): Promise<RawProLabore> {
    const proLabore = await this.prisma.proLabore.findUnique({
      where: { id },
      include: { empresa: true },
    });
    if (!proLabore || proLabore.empresa.usuarioId !== usuarioId) {
      throw new NotFoundException('pró-labore não encontrado');
    }
    return proLabore;
  }

  private calcularIrrf(valor: number, parametro: ParametroFiscalPfResult): number {
    if (valor <= parametro.faixaIsencaoMensal) {
      return 0;
    }
    const faixa =
      parametro.tabelaProgressivaMensal.find((f) => valor <= f.ate) ??
      parametro.tabelaProgressivaMensal[parametro.tabelaProgressivaMensal.length - 1];
    return Math.max(0, valor * faixa.aliquota - faixa.parcelaDeduzir);
  }

  private inicioMes(data: string): Date {
    const d = new Date(data);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }

  private toResult(proLabore: RawProLabore): ProLaboreResult {
    return {
      id: proLabore.id,
      empresaId: proLabore.empresaId,
      competencia: proLabore.competencia,
      valor: Number(proLabore.valor),
      inssRetido: Number(proLabore.inssRetido),
      irrfRetido: Number(proLabore.irrfRetido),
    };
  }
}
