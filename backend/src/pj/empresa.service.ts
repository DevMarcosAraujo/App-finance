import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AnexoSimples, AtividadeEmpresa, RegimeEmpresa } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';

export interface EmpresaResult {
  id: string;
  cnpj: string;
  nome: string;
  regime: RegimeEmpresa;
  atividadeTipo: AtividadeEmpresa;
  anexoSimples: AnexoSimples | null;
  dataAbertura: Date;
  ativa: boolean;
}

interface RawEmpresa {
  id: string;
  usuarioId: string;
  cnpj: string;
  nome: string;
  regime: RegimeEmpresa;
  atividadeTipo: AtividadeEmpresa;
  anexoSimples: AnexoSimples | null;
  dataAbertura: Date;
  ativa: boolean;
}

@Injectable()
export class EmpresaService {
  constructor(private readonly prisma: PrismaService) {}

  async create(usuarioId: string, dto: CreateEmpresaDto): Promise<EmpresaResult> {
    if (dto.regime === RegimeEmpresa.MEI && dto.anexoSimples !== undefined) {
      throw new BadRequestException('empresa MEI não pode ter anexoSimples');
    }
    const empresa = await this.prisma.empresa.create({
      data: {
        usuarioId,
        cnpj: dto.cnpj,
        nome: dto.nome,
        regime: dto.regime,
        atividadeTipo: dto.atividadeTipo,
        anexoSimples: dto.anexoSimples,
        dataAbertura: new Date(dto.dataAbertura),
      },
    });
    return this.toResult(empresa);
  }

  async findAll(usuarioId: string): Promise<EmpresaResult[]> {
    const empresas = await this.prisma.empresa.findMany({ where: { usuarioId } });
    return empresas.map((e) => this.toResult(e));
  }

  async findOwned(usuarioId: string, id: string): Promise<EmpresaResult> {
    const empresa = await this.prisma.empresa.findUnique({ where: { id } });
    if (!empresa || empresa.usuarioId !== usuarioId) {
      throw new NotFoundException('empresa não encontrada');
    }
    return this.toResult(empresa);
  }

  async update(usuarioId: string, id: string, dto: UpdateEmpresaDto): Promise<EmpresaResult> {
    await this.findOwned(usuarioId, id);
    const empresa = await this.prisma.empresa.update({
      where: { id },
      data: {
        ...(dto.nome !== undefined && { nome: dto.nome }),
        ...(dto.atividadeTipo !== undefined && { atividadeTipo: dto.atividadeTipo }),
        ...(dto.anexoSimples !== undefined && { anexoSimples: dto.anexoSimples }),
        ...(dto.ativa !== undefined && { ativa: dto.ativa }),
      },
    });
    return this.toResult(empresa);
  }

  async delete(usuarioId: string, id: string): Promise<void> {
    await this.findOwned(usuarioId, id);
    await this.prisma.empresa.delete({ where: { id } });
  }

  private toResult(empresa: RawEmpresa): EmpresaResult {
    return {
      id: empresa.id,
      cnpj: empresa.cnpj,
      nome: empresa.nome,
      regime: empresa.regime,
      atividadeTipo: empresa.atividadeTipo,
      anexoSimples: empresa.anexoSimples,
      dataAbertura: empresa.dataAbertura,
      ativa: empresa.ativa,
    };
  }
}
