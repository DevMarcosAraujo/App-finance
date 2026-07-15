import { ConflictException } from '@nestjs/common';
import { PlanoTipo, WorkspaceRole } from '@prisma/client';
import { WorkspaceService } from './workspace.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WorkspaceService', () => {
  const usuarioId = 'user-1';
  const usuarioNome = 'Marcos Teste';

  const buildService = () => {
    const prisma = {
      workspaceMembro: {
        findFirst: jest.fn(),
      },
      plano: {
        count: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        findFirst: jest.fn(),
      },
      workspace: {
        create: jest.fn(),
      },
    } as unknown as PrismaService;

    return { service: new WorkspaceService(prisma), prisma };
  };

  describe('create', () => {
    it('throws ConflictException when the user already has a workspace', async () => {
      const { service, prisma } = buildService();
      (prisma.workspaceMembro.findFirst as jest.Mock).mockResolvedValue({
        id: 'membro-1',
      });

      await expect(
        service.create(usuarioId, usuarioNome, PlanoTipo.INDIVIDUAL),
      ).rejects.toThrow(ConflictException);
      expect(prisma.workspace.create).not.toHaveBeenCalled();
    });

    it('seeds the default planos when none exist', async () => {
      const { service, prisma } = buildService();
      (prisma.workspaceMembro.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.plano.count as jest.Mock).mockResolvedValue(0);
      (prisma.plano.findFirst as jest.Mock).mockResolvedValue({
        id: 'plano-1',
        tipo: PlanoTipo.INDIVIDUAL,
      });
      (prisma.workspace.create as jest.Mock).mockResolvedValue({
        id: 'ws-1',
        nome: 'Financeiro de Marcos',
      });

      await service.create(usuarioId, usuarioNome, PlanoTipo.INDIVIDUAL);

      expect(prisma.plano.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ tipo: PlanoTipo.INDIVIDUAL }),
          expect.objectContaining({ tipo: PlanoTipo.FAMILIA }),
        ]),
      });
    });

    it('does not reseed planos when they already exist', async () => {
      const { service, prisma } = buildService();
      (prisma.workspaceMembro.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.plano.count as jest.Mock).mockResolvedValue(2);
      (prisma.plano.findFirst as jest.Mock).mockResolvedValue({
        id: 'plano-1',
        tipo: PlanoTipo.INDIVIDUAL,
      });
      (prisma.workspace.create as jest.Mock).mockResolvedValue({
        id: 'ws-1',
        nome: 'Financeiro de Marcos',
      });

      await service.create(usuarioId, usuarioNome, PlanoTipo.INDIVIDUAL);

      expect(prisma.plano.createMany).not.toHaveBeenCalled();
    });

    it('creates the workspace with an auto-generated name and the creator as DONO', async () => {
      const { service, prisma } = buildService();
      (prisma.workspaceMembro.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.plano.count as jest.Mock).mockResolvedValue(2);
      (prisma.plano.findFirst as jest.Mock).mockResolvedValue({
        id: 'plano-1',
        tipo: PlanoTipo.INDIVIDUAL,
      });
      (prisma.workspace.create as jest.Mock).mockResolvedValue({
        id: 'ws-1',
        nome: 'Financeiro de Marcos',
      });

      const result = await service.create(
        usuarioId,
        usuarioNome,
        PlanoTipo.INDIVIDUAL,
      );

      expect(prisma.workspace.create).toHaveBeenCalledWith({
        data: {
          nome: 'Financeiro de Marcos',
          planoId: 'plano-1',
          membros: {
            create: { usuarioId, role: WorkspaceRole.DONO },
          },
        },
      });
      expect(result).toEqual({
        id: 'ws-1',
        nome: 'Financeiro de Marcos',
        plano: { tipo: PlanoTipo.INDIVIDUAL },
      });
    });
  });
});
