import { ConflictException, Injectable } from '@nestjs/common';
import { PlanoTipo, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface WorkspaceResult {
  id: string;
  nome: string;
  plano: {
    tipo: PlanoTipo;
  };
}

const DEFAULT_PLANOS = [
  {
    tipo: PlanoTipo.INDIVIDUAL,
    nome: 'Individual',
    precoBase: 0,
    precoPorMembro: null,
    limiteMembros: 1,
  },
  {
    tipo: PlanoTipo.FAMILIA,
    nome: 'Família',
    precoBase: 0,
    precoPorMembro: 0,
    limiteMembros: null,
  },
];

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    usuarioId: string,
    usuarioNome: string,
    tipo: PlanoTipo,
  ): Promise<WorkspaceResult> {
    const existingMembership = await this.prisma.workspaceMembro.findFirst({
      where: { usuarioId },
    });

    if (existingMembership) {
      throw new ConflictException('usuário já pertence a um workspace');
    }

    await this.ensurePlanos();

    const plano = await this.prisma.plano.findFirst({ where: { tipo } });
    if (!plano) {
      throw new Error(`plano não encontrado para o tipo ${tipo}`);
    }

    const primeiroNome = usuarioNome.split(' ')[0];

    const workspace = await this.prisma.workspace.create({
      data: {
        nome: `Financeiro de ${primeiroNome}`,
        planoId: plano.id,
        membros: {
          create: { usuarioId, role: WorkspaceRole.DONO },
        },
      },
    });

    return {
      id: workspace.id,
      nome: workspace.nome,
      plano: { tipo: plano.tipo },
    };
  }

  private async ensurePlanos(): Promise<void> {
    const count = await this.prisma.plano.count();
    if (count > 0) {
      return;
    }

    await this.prisma.plano.createMany({ data: DEFAULT_PLANOS });
  }
}
