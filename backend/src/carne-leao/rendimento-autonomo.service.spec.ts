import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RendimentoAutonomoService } from './rendimento-autonomo.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';

describe('RendimentoAutonomoService', () => {
  const usuarioId = 'user-1';

  const buildService = () => {
    const prisma = {
      rendimentoAutonomo: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as PrismaService;

    const apuracaoService = {
      recalcular: jest.fn(),
    } as unknown as ApuracaoCarneLeaoService;

    return { service: new RendimentoAutonomoService(prisma, apuracaoService), prisma, apuracaoService };
  };

  describe('create', () => {
    it('cria um rendimento e recalcula a apuração da competência', async () => {
      const { service, prisma, apuracaoService } = buildService();
      (prisma.rendimentoAutonomo.create as jest.Mock).mockResolvedValue({
        id: 'r-1',
        tipo: 'HONORARIO',
        fontePagadoraCpf: '11144477735',
        valorBruto: '1500',
        documentoFiscalId: null,
        competencia: new Date(Date.UTC(2026, 6, 1)),
      });

      const result = await service.create(usuarioId, {
        tipo: 'HONORARIO',
        fontePagadoraCpf: '11144477735',
        valorBruto: 1500,
        competencia: '2026-07-15',
      });

      expect(prisma.rendimentoAutonomo.create).toHaveBeenCalledWith({
        data: {
          usuarioId,
          tipo: 'HONORARIO',
          fontePagadoraCpf: '11144477735',
          valorBruto: 1500,
          documentoFiscalId: undefined,
          competencia: new Date(Date.UTC(2026, 6, 1)),
        },
      });
      expect(apuracaoService.recalcular).toHaveBeenCalledWith(
        usuarioId,
        new Date(Date.UTC(2026, 6, 1)),
      );
      expect(result.valorBruto).toBe(1500);
    });
  });

  describe('findByMonth', () => {
    it('rejeita um mes fora do intervalo 1-12', async () => {
      const { service } = buildService();
      await expect(service.findByMonth(usuarioId, 2026, 0)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('atualiza um rendimento próprio e recalcula a apuração', async () => {
      const { service, prisma, apuracaoService } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (prisma.rendimentoAutonomo.findUnique as jest.Mock).mockResolvedValue({
        id: 'r-1',
        usuarioId,
        competencia,
      });
      (prisma.rendimentoAutonomo.update as jest.Mock).mockResolvedValue({
        id: 'r-1',
        tipo: 'HONORARIO',
        fontePagadoraCpf: '11144477735',
        valorBruto: '2000',
        documentoFiscalId: null,
        competencia,
      });

      const result = await service.update(usuarioId, 'r-1', { valorBruto: 2000 });

      expect(prisma.rendimentoAutonomo.update).toHaveBeenCalledWith({
        where: { id: 'r-1' },
        data: { valorBruto: 2000 },
      });
      expect(apuracaoService.recalcular).toHaveBeenCalledWith(usuarioId, competencia);
      expect(result.valorBruto).toBe(2000);
    });

    it('lança NotFoundException ao editar rendimento de outro usuário', async () => {
      const { service, prisma } = buildService();
      (prisma.rendimentoAutonomo.findUnique as jest.Mock).mockResolvedValue({
        id: 'r-1',
        usuarioId: 'outro-usuario',
        competencia: new Date(),
      });

      await expect(
        service.update(usuarioId, 'r-1', { valorBruto: 2000 }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.rendimentoAutonomo.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('exclui um rendimento próprio e recalcula a apuração', async () => {
      const { service, prisma, apuracaoService } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (prisma.rendimentoAutonomo.findUnique as jest.Mock).mockResolvedValue({
        id: 'r-1',
        usuarioId,
        competencia,
      });

      await service.delete(usuarioId, 'r-1');

      expect(prisma.rendimentoAutonomo.delete).toHaveBeenCalledWith({ where: { id: 'r-1' } });
      expect(apuracaoService.recalcular).toHaveBeenCalledWith(usuarioId, competencia);
    });

    it('lança NotFoundException ao excluir rendimento de outro usuário', async () => {
      const { service, prisma } = buildService();
      (prisma.rendimentoAutonomo.findUnique as jest.Mock).mockResolvedValue({
        id: 'r-1',
        usuarioId: 'outro-usuario',
        competencia: new Date(),
      });

      await expect(service.delete(usuarioId, 'r-1')).rejects.toThrow(NotFoundException);
      expect(prisma.rendimentoAutonomo.delete).not.toHaveBeenCalled();
    });
  });
});
