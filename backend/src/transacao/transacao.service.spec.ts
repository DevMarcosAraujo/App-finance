import { BadRequestException } from '@nestjs/common';
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
});
