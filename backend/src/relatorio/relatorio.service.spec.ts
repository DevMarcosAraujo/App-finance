import { TransacaoTipo } from '@prisma/client';
import { RelatorioService } from './relatorio.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RelatorioService', () => {
  const workspaceId = 'ws-1';

  const buildService = () => {
    const prisma = {
      transacao: { findMany: jest.fn() },
    } as unknown as PrismaService;

    return { service: new RelatorioService(prisma), prisma };
  };

  describe('agregar', () => {
    it('soma receitas e despesas por categoria dentro do período', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.findMany as jest.Mock).mockResolvedValue([
        {
          tipo: TransacaoTipo.RECEITA,
          valor: '1000.00',
          categoriaId: 'cat-1',
          categoria: { id: 'cat-1', nome: 'Salário' },
        },
        {
          tipo: TransacaoTipo.DESPESA,
          valor: '200.50',
          categoriaId: 'cat-2',
          categoria: { id: 'cat-2', nome: 'Mercado' },
        },
        {
          tipo: TransacaoTipo.DESPESA,
          valor: '99.50',
          categoriaId: 'cat-2',
          categoria: { id: 'cat-2', nome: 'Mercado' },
        },
        {
          tipo: TransacaoTipo.DESPESA,
          valor: '50.00',
          categoriaId: null,
          categoria: null,
        },
      ]);

      const inicio = new Date('2026-07-01T00:00:00.000Z');
      const fim = new Date('2026-08-01T00:00:00.000Z');
      const result = await service.agregar(workspaceId, inicio, fim);

      expect(prisma.transacao.findMany).toHaveBeenCalledWith({
        where: { workspaceId, data: { gte: inicio, lt: fim } },
        include: { categoria: true },
      });

      expect(result.totalReceitas).toBe(1000);
      expect(result.totalDespesas).toBe(350);
      expect(result.saldo).toBe(650);
      expect(result.porCategoria).toEqual(
        expect.arrayContaining([
          {
            categoriaId: 'cat-1',
            categoriaNome: 'Salário',
            totalReceitas: 1000,
            totalDespesas: 0,
          },
          {
            categoriaId: 'cat-2',
            categoriaNome: 'Mercado',
            totalReceitas: 0,
            totalDespesas: 300,
          },
          {
            categoriaId: null,
            categoriaNome: 'Sem categoria',
            totalReceitas: 0,
            totalDespesas: 50,
          },
        ]),
      );
      expect(result.porCategoria).toHaveLength(3);
    });

    it('retorna agregação zerada quando não há transações no período', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.agregar(
        workspaceId,
        new Date('2026-07-01T00:00:00.000Z'),
        new Date('2026-08-01T00:00:00.000Z'),
      );

      expect(result).toEqual({
        totalReceitas: 0,
        totalDespesas: 0,
        saldo: 0,
        porCategoria: [],
      });
    });
  });
});
