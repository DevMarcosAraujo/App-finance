import { NotFoundException } from '@nestjs/common';
import { PlanoTipo } from '@prisma/client';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('WorkspaceController', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    nome: 'Marcos',
    email: 'marcos@example.com',
    cpf: '11144477735',
    criadoEm: new Date(),
  };

  const workspaceResult = {
    id: 'ws-1',
    nome: 'Financeiro de Marcos',
    plano: { tipo: PlanoTipo.INDIVIDUAL },
  };

  const buildController = () => {
    const workspaceService = {
      create: jest.fn().mockResolvedValue(workspaceResult),
      findMine: jest.fn(),
    } as unknown as WorkspaceService;

    return {
      controller: new WorkspaceController(workspaceService),
      workspaceService,
    };
  };

  it('delegates create to WorkspaceService with the current user id and nome', async () => {
    const { controller, workspaceService } = buildController();

    const result = await controller.create(
      { tipo: PlanoTipo.INDIVIDUAL },
      user,
    );

    expect(workspaceService.create).toHaveBeenCalledWith(
      user.id,
      user.nome,
      PlanoTipo.INDIVIDUAL,
    );
    expect(result).toEqual(workspaceResult);
  });

  it('returns the workspace for findMine when it exists', async () => {
    const { controller, workspaceService } = buildController();
    (workspaceService.findMine as jest.Mock).mockResolvedValue(workspaceResult);

    const result = await controller.findMine(user);

    expect(result).toEqual(workspaceResult);
  });

  it('throws NotFoundException for findMine when no workspace exists', async () => {
    const { controller, workspaceService } = buildController();
    (workspaceService.findMine as jest.Mock).mockResolvedValue(null);

    await expect(controller.findMine(user)).rejects.toThrow(NotFoundException);
  });
});
