import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransacaoTipo } from '@prisma/client';
import { TransacaoService } from './transacao.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TransacaoService', () => {
  const workspaceId = 'ws-1';
  const usuarioId = 'user-1';

  const buildService = () => {
    const prisma = {
      categoria: { findUnique: jest.fn() },
      transacao: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as PrismaService;

    return { service: new TransacaoService(prisma), prisma };
  };

  describe('create', () => {
    it('creates a transacao without categoria', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.create as jest.Mock).mockResolvedValue({
        id: 'tx-1',
        tipo: TransacaoTipo.DESPESA,
        valor: '42.5',
        categoria: null,
        descricao: null,
        data: new Date('2026-07-15T00:00:00.000Z'),
        usuarioId,
      });

      const result = await service.create(workspaceId, usuarioId, {
        tipo: TransacaoTipo.DESPESA,
        valor: 42.5,
        data: '2026-07-15',
      });

      expect(prisma.transacao.create).toHaveBeenCalledWith({
        data: {
          workspaceId,
          usuarioId,
          tipo: TransacaoTipo.DESPESA,
          valor: 42.5,
          categoriaId: undefined,
          descricao: undefined,
          data: new Date('2026-07-15'),
        },
        include: { categoria: true },
      });
      expect(result.valor).toBe(42.5);
      expect(result.categoria).toBeNull();
    });

    it('rejects an unknown categoriaId', async () => {
      const { service, prisma } = buildService();
      (prisma.categoria.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create(workspaceId, usuarioId, {
          tipo: TransacaoTipo.DESPESA,
          valor: 10,
          categoriaId: 'cat-inexistente',
          data: '2026-07-15',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.transacao.create).not.toHaveBeenCalled();
    });
  });

  describe('findByMonth', () => {
    it('queries transacoes within the month range, ordered by data desc', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.findMany as jest.Mock).mockResolvedValue([]);

      await service.findByMonth(workspaceId, 2026, 7);

      expect(prisma.transacao.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId,
          data: {
            gte: new Date(Date.UTC(2026, 6, 1)),
            lt: new Date(Date.UTC(2026, 7, 1)),
          },
        },
        orderBy: { data: 'desc' },
        include: { categoria: true },
      });
    });

    it('handles december correctly (wraps to next year)', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.findMany as jest.Mock).mockResolvedValue([]);

      await service.findByMonth(workspaceId, 2026, 12);

      expect(prisma.transacao.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId,
          data: {
            gte: new Date(Date.UTC(2026, 11, 1)),
            lt: new Date(Date.UTC(2027, 0, 1)),
          },
        },
        orderBy: { data: 'desc' },
        include: { categoria: true },
      });
    });

    it('rejects an out-of-range mes', async () => {
      const { service } = buildService();

      await expect(
        service.findByMonth(workspaceId, 2026, 13),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('updates a transacao belonging to the workspace', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.findUnique as jest.Mock).mockResolvedValue({
        id: 'tx-1',
        workspaceId,
      });
      (prisma.transacao.update as jest.Mock).mockResolvedValue({
        id: 'tx-1',
        tipo: TransacaoTipo.RECEITA,
        valor: '100',
        categoria: null,
        descricao: 'atualizado',
        data: new Date('2026-07-16T00:00:00.000Z'),
        usuarioId,
      });

      const result = await service.update(workspaceId, 'tx-1', {
        descricao: 'atualizado',
      });

      expect(prisma.transacao.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: { descricao: 'atualizado' },
        include: { categoria: true },
      });
      expect(result.descricao).toBe('atualizado');
    });

    it('throws NotFoundException when the transacao belongs to another workspace', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.findUnique as jest.Mock).mockResolvedValue({
        id: 'tx-1',
        workspaceId: 'outro-workspace',
      });

      await expect(
        service.update(workspaceId, 'tx-1', { descricao: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.transacao.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the transacao does not exist', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update(workspaceId, 'tx-inexistente', { descricao: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an unknown categoriaId on update', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.findUnique as jest.Mock).mockResolvedValue({
        id: 'tx-1',
        workspaceId,
      });
      (prisma.categoria.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update(workspaceId, 'tx-1', { categoriaId: 'cat-inexistente' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.transacao.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes a transacao belonging to the workspace', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.findUnique as jest.Mock).mockResolvedValue({
        id: 'tx-1',
        workspaceId,
      });

      await service.delete(workspaceId, 'tx-1');

      expect(prisma.transacao.delete).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
      });
    });

    it('throws NotFoundException when the transacao belongs to another workspace', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.findUnique as jest.Mock).mockResolvedValue({
        id: 'tx-1',
        workspaceId: 'outro-workspace',
      });

      await expect(service.delete(workspaceId, 'tx-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.transacao.delete).not.toHaveBeenCalled();
    });
  });
});
