import { NotFoundException } from '@nestjs/common';
import { ProLaboreService } from './pro-labore.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmpresaService } from './empresa.service';
import { ParametroFiscalPfService } from '../carne-leao/parametro-fiscal-pf.service';

describe('ProLaboreService', () => {
  const usuarioId = 'user-1';
  const empresaId = 'e-1';

  const parametroTeste = {
    faixaIsencaoMensal: 2000,
    faixaReducaoAte: 3000,
    tabelaProgressivaMensal: [
      { ate: 2000, aliquota: 0, parcelaDeduzir: 0 },
      { ate: 3000, aliquota: 0.1, parcelaDeduzir: 100 },
      { ate: 999999999, aliquota: 0.2, parcelaDeduzir: 400 },
    ],
  };

  const buildService = () => {
    const prisma = {
      proLabore: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as PrismaService;

    const empresaService = { findOwned: jest.fn() } as unknown as EmpresaService;
    const parametroFiscalPfService = {
      buscarPorAno: jest.fn().mockResolvedValue(parametroTeste),
    } as unknown as ParametroFiscalPfService;

    return {
      service: new ProLaboreService(prisma, empresaService, parametroFiscalPfService),
      prisma,
      empresaService,
      parametroFiscalPfService,
    };
  };

  describe('create', () => {
    it('calcula irrfRetido pela tabela progressiva e mantém inssRetido do DTO', async () => {
      const { service, prisma, empresaService } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (empresaService.findOwned as jest.Mock).mockResolvedValue({ id: empresaId });
      (prisma.proLabore.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: 'p-1', ...data }),
      );

      const result = await service.create(usuarioId, {
        empresaId,
        valor: 3500,
        inssRetido: 385,
        competencia: '2026-07-15',
      });

      // valor 3500 > faixaReducaoAte -> faixa 20%: 3500*0.2-400 = 300
      expect(result.irrfRetido).toBe(300);
      expect(result.inssRetido).toBe(385);
      expect(prisma.proLabore.create).toHaveBeenCalledWith({
        data: { empresaId, competencia, valor: 3500, inssRetido: 385, irrfRetido: 300 },
      });
    });

    it('retorna irrfRetido zero para valor abaixo da faixa de isenção', async () => {
      const { service, empresaService } = buildService();
      (empresaService.findOwned as jest.Mock).mockResolvedValue({ id: empresaId });

      const result = await service.create(usuarioId, {
        empresaId,
        valor: 1500,
        inssRetido: 165,
        competencia: '2026-07-15',
      });

      expect(result.irrfRetido).toBe(0);
    });
  });

  describe('update', () => {
    it('lança NotFoundException ao editar pró-labore de empresa de outro usuário', async () => {
      const { service, prisma } = buildService();
      (prisma.proLabore.findUnique as jest.Mock).mockResolvedValue({
        id: 'p-1',
        empresaId,
        valor: '3000',
        competencia: new Date(),
        empresa: { usuarioId: 'outro-usuario' },
      });

      await expect(service.update(usuarioId, 'p-1', { valor: 4000 })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.proLabore.update).not.toHaveBeenCalled();
    });

    it('recalcula irrfRetido quando o valor muda', async () => {
      const { service, prisma } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (prisma.proLabore.findUnique as jest.Mock).mockResolvedValue({
        id: 'p-1',
        empresaId,
        valor: '1500',
        inssRetido: '165',
        competencia,
        empresa: { usuarioId },
      });
      (prisma.proLabore.update as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: 'p-1', empresaId, competencia, ...data }),
      );

      const result = await service.update(usuarioId, 'p-1', { valor: 3500 });

      expect(result.irrfRetido).toBe(300);
    });
  });

  describe('delete', () => {
    it('exclui um pró-labore próprio', async () => {
      const { service, prisma } = buildService();
      (prisma.proLabore.findUnique as jest.Mock).mockResolvedValue({
        id: 'p-1',
        empresaId,
        valor: '3000',
        competencia: new Date(),
        empresa: { usuarioId },
      });

      await service.delete(usuarioId, 'p-1');

      expect(prisma.proLabore.delete).toHaveBeenCalledWith({ where: { id: 'p-1' } });
    });
  });
});
