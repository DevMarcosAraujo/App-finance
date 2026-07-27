import { NotFoundException } from '@nestjs/common';
import { DistribuicaoLucrosService } from './distribuicao-lucros.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmpresaService } from './empresa.service';
import { ParametroFiscalPjService } from './parametro-fiscal-pj.service';

describe('DistribuicaoLucrosService', () => {
  const usuarioId = 'user-1';
  const empresaId = 'e-1';

  const buildService = () => {
    const prisma = {
      distribuicaoLucros: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as PrismaService;

    const empresaService = { findOwned: jest.fn() } as unknown as EmpresaService;
    const parametroFiscalPjService = {
      buscarPorAno: jest.fn().mockResolvedValue({ limiteDividendoIsentoMensal: 50000 }),
    } as unknown as ParametroFiscalPjService;

    return {
      service: new DistribuicaoLucrosService(prisma, empresaService, parametroFiscalPjService),
      prisma,
      empresaService,
    };
  };

  describe('create', () => {
    it('marca isento quando o valor está dentro do limite (fronteira exata)', async () => {
      const { service, prisma, empresaService } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (empresaService.findOwned as jest.Mock).mockResolvedValue({ id: empresaId });
      (prisma.distribuicaoLucros.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: 'dl-1', ...data }),
      );

      const result = await service.create(usuarioId, {
        empresaId,
        valor: 50000,
        competencia: '2026-07-15',
      });

      expect(result.isento).toBe(true);
      expect(result.impostoRetido).toBe(0);
      expect(prisma.distribuicaoLucros.create).toHaveBeenCalledWith({
        data: { empresaId, competencia, valor: 50000, isento: true, impostoRetido: 0 },
      });
    });

    it('marca não isento quando o valor excede o limite, mas impostoRetido continua zero', async () => {
      const { service, empresaService } = buildService();
      (empresaService.findOwned as jest.Mock).mockResolvedValue({ id: empresaId });

      const result = await service.create(usuarioId, {
        empresaId,
        valor: 50000.01,
        competencia: '2026-07-15',
      });

      expect(result.isento).toBe(false);
      expect(result.impostoRetido).toBe(0);
    });
  });

  describe('update', () => {
    it('lança NotFoundException ao editar distribuição de empresa de outro usuário', async () => {
      const { service, prisma } = buildService();
      (prisma.distribuicaoLucros.findUnique as jest.Mock).mockResolvedValue({
        id: 'dl-1',
        empresaId,
        valor: '10000',
        competencia: new Date(),
        empresa: { usuarioId: 'outro-usuario' },
      });

      await expect(service.update(usuarioId, 'dl-1', { valor: 20000 })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.distribuicaoLucros.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('exclui uma distribuição própria', async () => {
      const { service, prisma } = buildService();
      (prisma.distribuicaoLucros.findUnique as jest.Mock).mockResolvedValue({
        id: 'dl-1',
        empresaId,
        valor: '10000',
        competencia: new Date(),
        empresa: { usuarioId },
      });

      await service.delete(usuarioId, 'dl-1');

      expect(prisma.distribuicaoLucros.delete).toHaveBeenCalledWith({ where: { id: 'dl-1' } });
    });
  });
});
