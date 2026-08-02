import { TransacaoTipo, TipoRelatorio } from '@prisma/client';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { RelatorioService } from './relatorio.service';
import { PrismaService } from '../prisma/prisma.service';

// `renderRelatorioPdf` (Task 3) depende de @react-pdf/renderer, um pacote ESM
// puro (via yoga-layout) que não pode ser carregado dentro do runtime de
// módulos do Jest (nem com import estático nem dinâmico, mesmo com
// --experimental-vm-modules — o ts-jest compila para CommonJS e a ponte
// ESM/CJS do Jest não interopera com esse output). A renderização real já é
// coberta pelos testes de `relatorio.pdf.spec.ts` (via subprocesso com
// ts-node). Aqui mockamos para testar apenas a orquestração do service.
jest.mock('./relatorio.pdf', () => ({
  renderRelatorioPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake')),
}));

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

  describe('gerar / listar / buscarArquivo', () => {
    const workspaceId = 'ws-1';
    let storageDir: string;

    const buildService = () => {
      const prisma = {
        transacao: { findMany: jest.fn().mockResolvedValue([]) },
        relatorioGerado: {
          create: jest.fn(),
          update: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
        },
      } as unknown as PrismaService;

      const service = new RelatorioService(prisma);
      (service as unknown as { storageDir: string }).storageDir = storageDir;

      return { service, prisma };
    };

    beforeEach(async () => {
      storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'relatorios-test-'));
    });

    afterEach(async () => {
      await fs.rm(storageDir, { recursive: true, force: true });
    });

    it('gera o PDF, salva em disco (nomeado com o id do registro) e persiste o registro', async () => {
      const { service, prisma } = buildService();
      (prisma.relatorioGerado.create as jest.Mock).mockResolvedValue({
        id: 'rel-1',
        tipo: TipoRelatorio.MENSAL,
        periodoInicio: new Date('2026-07-01T00:00:00.000Z'),
        periodoFim: new Date('2026-08-01T00:00:00.000Z'),
        arquivoPdfUrl: '',
        geradoEm: new Date('2026-08-02T00:00:00.000Z'),
      });
      (prisma.relatorioGerado.update as jest.Mock).mockResolvedValue({
        id: 'rel-1',
        tipo: TipoRelatorio.MENSAL,
        periodoInicio: new Date('2026-07-01T00:00:00.000Z'),
        periodoFim: new Date('2026-08-01T00:00:00.000Z'),
        arquivoPdfUrl: '/relatorios/rel-1/arquivo',
        geradoEm: new Date('2026-08-02T00:00:00.000Z'),
      });

      const result = await service.gerar(workspaceId, {
        tipo: TipoRelatorio.MENSAL,
        periodoInicio: new Date('2026-07-01T00:00:00.000Z'),
        periodoFim: new Date('2026-08-01T00:00:00.000Z'),
      });

      expect(result.id).toBe('rel-1');
      expect(result.arquivoPdfUrl).toBe('/relatorios/rel-1/arquivo');
      expect(prisma.relatorioGerado.update).toHaveBeenCalledWith({
        where: { id: 'rel-1' },
        data: { arquivoPdfUrl: '/relatorios/rel-1/arquivo' },
      });

      const arquivos = await fs.readdir(path.join(storageDir, workspaceId));
      expect(arquivos).toEqual(['rel-1.pdf']);
    });

    it('lista relatórios do workspace', async () => {
      const { service, prisma } = buildService();
      (prisma.relatorioGerado.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rel-1',
          tipo: TipoRelatorio.MENSAL,
          periodoInicio: new Date('2026-07-01T00:00:00.000Z'),
          periodoFim: new Date('2026-08-01T00:00:00.000Z'),
          arquivoPdfUrl: '/relatorios/rel-1/arquivo',
          geradoEm: new Date('2026-08-02T00:00:00.000Z'),
        },
      ]);

      const result = await service.listar(workspaceId);

      expect(prisma.relatorioGerado.findMany).toHaveBeenCalledWith({
        where: { workspaceId },
        orderBy: { geradoEm: 'desc' },
      });
      expect(result).toHaveLength(1);
    });

    it('busca o arquivo de um relatório pertencente ao workspace', async () => {
      const { service, prisma } = buildService();
      (prisma.relatorioGerado.create as jest.Mock).mockResolvedValue({
        id: 'rel-1',
        tipo: TipoRelatorio.MENSAL,
        periodoInicio: new Date('2026-07-01T00:00:00.000Z'),
        periodoFim: new Date('2026-08-01T00:00:00.000Z'),
        arquivoPdfUrl: '',
        geradoEm: new Date('2026-08-02T00:00:00.000Z'),
      });
      (prisma.relatorioGerado.update as jest.Mock).mockResolvedValue({
        id: 'rel-1',
        tipo: TipoRelatorio.MENSAL,
        periodoInicio: new Date('2026-07-01T00:00:00.000Z'),
        periodoFim: new Date('2026-08-01T00:00:00.000Z'),
        arquivoPdfUrl: '/relatorios/rel-1/arquivo',
        geradoEm: new Date('2026-08-02T00:00:00.000Z'),
      });
      await service.gerar(workspaceId, {
        tipo: TipoRelatorio.MENSAL,
        periodoInicio: new Date('2026-07-01T00:00:00.000Z'),
        periodoFim: new Date('2026-08-01T00:00:00.000Z'),
      });
      (prisma.relatorioGerado.findUnique as jest.Mock).mockResolvedValue({
        id: 'rel-1',
        workspaceId,
      });

      const buffer = await service.buscarArquivo(workspaceId, 'rel-1');

      expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
    });

    it('lança NotFoundException ao buscar arquivo de outro workspace', async () => {
      const { service, prisma } = buildService();
      (prisma.relatorioGerado.findUnique as jest.Mock).mockResolvedValue({
        id: 'rel-1',
        workspaceId: 'outro-workspace',
      });

      await expect(service.buscarArquivo(workspaceId, 'rel-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança NotFoundException quando o relatório não existe', async () => {
      const { service, prisma } = buildService();
      (prisma.relatorioGerado.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.buscarArquivo(workspaceId, 'rel-inexistente'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
