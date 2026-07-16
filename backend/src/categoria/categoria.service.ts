import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CategoriaResult {
  id: string;
  nome: string;
  cor: string | null;
  icone: string | null;
}

const DEFAULT_CATEGORIAS = [
  { nome: 'Salário', cor: '#22C55E', icone: null, sistema: true },
  { nome: 'Renda Extra', cor: '#16A34A', icone: null, sistema: true },
  { nome: 'Alimentação', cor: '#F97316', icone: null, sistema: true },
  { nome: 'Transporte', cor: '#3B82F6', icone: null, sistema: true },
  { nome: 'Moradia', cor: '#8B5CF6', icone: null, sistema: true },
  { nome: 'Saúde', cor: '#EF4444', icone: null, sistema: true },
  { nome: 'Lazer', cor: '#EC4899', icone: null, sistema: true },
  { nome: 'Educação', cor: '#06B6D4', icone: null, sistema: true },
  { nome: 'Compras', cor: '#F59E0B', icone: null, sistema: true },
  { nome: 'Outros', cor: '#6B7280', icone: null, sistema: true },
];

@Injectable()
export class CategoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<CategoriaResult[]> {
    await this.ensureSeed();

    const categorias = await this.prisma.categoria.findMany({
      where: { sistema: true },
      orderBy: { nome: 'asc' },
    });

    return categorias.map((categoria) => ({
      id: categoria.id,
      nome: categoria.nome,
      cor: categoria.cor,
      icone: categoria.icone,
    }));
  }

  private async ensureSeed(): Promise<void> {
    const count = await this.prisma.categoria.count();
    if (count > 0) {
      return;
    }

    await this.prisma.categoria.createMany({ data: DEFAULT_CATEGORIAS });
  }
}
