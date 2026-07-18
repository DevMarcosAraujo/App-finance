import { NotFoundException } from '@nestjs/common';
import { DeducaoCarneLeaoService } from './deducao-carne-leao.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';

describe('DeducaoCarneLeaoService', () => {
  const usuarioId = 'user-1';

  const buildService = () => {
    const prisma = {
      deducaoCarneLeao: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as PrismaService;

    const apuracaoService = { recalcular: jest.fn() } as unknown as ApuracaoCarneLeaoService;

    return { service: new DeducaoCarneLeaoService(prisma, apuracaoService), prisma, apuracaoService };
  };

  describe('create', () => {
    it('cria uma dedução e recalcula a apuração da competência', async () => {
      const { service, prisma, apuracaoService } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (prisma.deducaoCarneLeao.create as jest.Mock).mockResolvedValue({
        id: 'd-1',
        tipo: 'INSS_AUTONOMO',
        valor: '500',
        anexoUrl: null,
        competencia,
      });

      const result = await service.create(usuarioId, {
        tipo: 'INSS_AUTONOMO',
        valor: 500,
        competencia: '2026-07-15',
      });

      expect(prisma.deducaoCarneLeao.create).toHaveBeenCalledWith({
        data: { usuarioId, tipo: 'INSS_AUTONOMO', valor: 500, anexoUrl: undefined, competencia },
      });
      expect(apuracaoService.recalcular).toHaveBeenCalledWith(usuarioId, competencia);
      expect(result.valor).toBe(500);
    });
  });

  describe('update', () => {
    it('lança NotFoundException ao editar dedução de outro usuário', async () => {
      const { service, prisma } = buildService();
      (prisma.deducaoCarneLeao.findUnique as jest.Mock).mockResolvedValue({
        id: 'd-1',
        usuarioId: 'outro-usuario',
        competencia: new Date(),
      });

      await expect(service.update(usuarioId, 'd-1', { valor: 600 })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.deducaoCarneLeao.update).not.toHaveBeenCalled();
    });

    it('recalcula tanto a competência antiga quanto a nova quando a competência muda de mês', async () => {
      const { service, prisma, apuracaoService } = buildService();
      const competenciaAntiga = new Date(Date.UTC(2026, 5, 1));
      const competenciaNova = new Date(Date.UTC(2026, 6, 1));
      (prisma.deducaoCarneLeao.findUnique as jest.Mock).mockResolvedValue({
        id: 'd-1',
        usuarioId,
        competencia: competenciaAntiga,
      });
      (prisma.deducaoCarneLeao.update as jest.Mock).mockResolvedValue({
        id: 'd-1',
        tipo: 'INSS_AUTONOMO',
        valor: '600',
        anexoUrl: null,
        competencia: competenciaNova,
      });

      await service.update(usuarioId, 'd-1', { competencia: '2026-07-15' });

      expect(apuracaoService.recalcular).toHaveBeenCalledTimes(2);
      expect(apuracaoService.recalcular).toHaveBeenNthCalledWith(1, usuarioId, competenciaAntiga);
      expect(apuracaoService.recalcular).toHaveBeenNthCalledWith(2, usuarioId, competenciaNova);
    });

    it('recalcula a apuração apenas uma vez quando a competência muda de dia mas permanece no mesmo mês', async () => {
      const { service, prisma, apuracaoService } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (prisma.deducaoCarneLeao.findUnique as jest.Mock).mockResolvedValue({
        id: 'd-1',
        usuarioId,
        competencia,
      });
      (prisma.deducaoCarneLeao.update as jest.Mock).mockResolvedValue({
        id: 'd-1',
        tipo: 'INSS_AUTONOMO',
        valor: '600',
        anexoUrl: null,
        competencia,
      });

      await service.update(usuarioId, 'd-1', { competencia: '2026-07-20' });

      expect(apuracaoService.recalcular).toHaveBeenCalledTimes(1);
      expect(apuracaoService.recalcular).toHaveBeenCalledWith(usuarioId, competencia);
    });
  });

  describe('delete', () => {
    it('exclui uma dedução própria e recalcula a apuração', async () => {
      const { service, prisma, apuracaoService } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (prisma.deducaoCarneLeao.findUnique as jest.Mock).mockResolvedValue({
        id: 'd-1',
        usuarioId,
        competencia,
      });

      await service.delete(usuarioId, 'd-1');

      expect(prisma.deducaoCarneLeao.delete).toHaveBeenCalledWith({ where: { id: 'd-1' } });
      expect(apuracaoService.recalcular).toHaveBeenCalledWith(usuarioId, competencia);
    });
  });
});
