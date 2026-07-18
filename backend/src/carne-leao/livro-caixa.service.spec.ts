import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LivroCaixaService } from './livro-caixa.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';

describe('LivroCaixaService', () => {
  const usuarioId = 'user-1';

  const buildService = () => {
    const prisma = {
      livroCaixaLancamento: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as PrismaService;

    const apuracaoService = { recalcular: jest.fn() } as unknown as ApuracaoCarneLeaoService;

    return { service: new LivroCaixaService(prisma, apuracaoService), prisma, apuracaoService };
  };

  describe('create', () => {
    it('cria um lançamento e recalcula a apuração da competência', async () => {
      const { service, prisma, apuracaoService } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (prisma.livroCaixaLancamento.create as jest.Mock).mockResolvedValue({
        id: 'lc-1',
        descricao: 'aluguel do escritório',
        categoria: 'aluguel_escritorio',
        valor: '300',
        competencia,
      });

      const result = await service.create(usuarioId, {
        descricao: 'aluguel do escritório',
        categoria: 'aluguel_escritorio',
        valor: 300,
        competencia: '2026-07-15',
      });

      expect(prisma.livroCaixaLancamento.create).toHaveBeenCalledWith({
        data: {
          usuarioId,
          descricao: 'aluguel do escritório',
          categoria: 'aluguel_escritorio',
          valor: 300,
          competencia,
        },
      });
      expect(apuracaoService.recalcular).toHaveBeenCalledWith(usuarioId, competencia);
      expect(result.valor).toBe(300);
    });
  });

  describe('findByMonth', () => {
    it('lança BadRequestException quando mes está fora do intervalo 1-12', async () => {
      const { service } = buildService();

      await expect(service.findByMonth(usuarioId, 2026, 0)).rejects.toThrow(BadRequestException);
      await expect(service.findByMonth(usuarioId, 2026, 13)).rejects.toThrow(BadRequestException);
    });

    it('retorna os lançamentos do mês solicitado', async () => {
      const { service, prisma } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (prisma.livroCaixaLancamento.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'lc-1',
          descricao: 'aluguel do escritório',
          categoria: 'aluguel_escritorio',
          valor: '300',
          competencia,
        },
      ]);

      const result = await service.findByMonth(usuarioId, 2026, 7);

      expect(prisma.livroCaixaLancamento.findMany).toHaveBeenCalledWith({
        where: { usuarioId, competencia },
      });
      expect(result).toHaveLength(1);
      expect(result[0].valor).toBe(300);
    });
  });

  describe('update', () => {
    it('lança NotFoundException ao editar lançamento de outro usuário', async () => {
      const { service, prisma } = buildService();
      (prisma.livroCaixaLancamento.findUnique as jest.Mock).mockResolvedValue({
        id: 'lc-1',
        usuarioId: 'outro-usuario',
        competencia: new Date(),
      });

      await expect(service.update(usuarioId, 'lc-1', { valor: 400 })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.livroCaixaLancamento.update).not.toHaveBeenCalled();
    });

    it('atualiza um lançamento próprio e recalcula a apuração', async () => {
      const { service, prisma, apuracaoService } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (prisma.livroCaixaLancamento.findUnique as jest.Mock).mockResolvedValue({
        id: 'lc-1',
        usuarioId,
        competencia,
      });
      (prisma.livroCaixaLancamento.update as jest.Mock).mockResolvedValue({
        id: 'lc-1',
        descricao: 'aluguel do escritório',
        categoria: 'aluguel_escritorio',
        valor: '400',
        competencia,
      });

      const result = await service.update(usuarioId, 'lc-1', { valor: 400 });

      expect(prisma.livroCaixaLancamento.update).toHaveBeenCalledWith({
        where: { id: 'lc-1' },
        data: { valor: 400 },
      });
      expect(apuracaoService.recalcular).toHaveBeenCalledWith(usuarioId, competencia);
      expect(result.valor).toBe(400);
    });

    it('recalcula tanto a competência antiga quanto a nova quando a competência muda de mês', async () => {
      const { service, prisma, apuracaoService } = buildService();
      const competenciaAntiga = new Date(Date.UTC(2026, 5, 1));
      const competenciaNova = new Date(Date.UTC(2026, 6, 1));
      (prisma.livroCaixaLancamento.findUnique as jest.Mock).mockResolvedValue({
        id: 'lc-1',
        usuarioId,
        competencia: competenciaAntiga,
      });
      (prisma.livroCaixaLancamento.update as jest.Mock).mockResolvedValue({
        id: 'lc-1',
        descricao: 'aluguel do escritório',
        categoria: 'aluguel_escritorio',
        valor: '300',
        competencia: competenciaNova,
      });

      await service.update(usuarioId, 'lc-1', { competencia: '2026-07-15' });

      expect(apuracaoService.recalcular).toHaveBeenCalledTimes(2);
      expect(apuracaoService.recalcular).toHaveBeenNthCalledWith(1, usuarioId, competenciaAntiga);
      expect(apuracaoService.recalcular).toHaveBeenNthCalledWith(2, usuarioId, competenciaNova);
    });

    it('recalcula a apuração apenas uma vez quando a competência muda de dia mas permanece no mesmo mês', async () => {
      const { service, prisma, apuracaoService } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (prisma.livroCaixaLancamento.findUnique as jest.Mock).mockResolvedValue({
        id: 'lc-1',
        usuarioId,
        competencia,
      });
      (prisma.livroCaixaLancamento.update as jest.Mock).mockResolvedValue({
        id: 'lc-1',
        descricao: 'aluguel do escritório',
        categoria: 'aluguel_escritorio',
        valor: '300',
        competencia,
      });

      await service.update(usuarioId, 'lc-1', { competencia: '2026-07-20' });

      expect(apuracaoService.recalcular).toHaveBeenCalledTimes(1);
      expect(apuracaoService.recalcular).toHaveBeenCalledWith(usuarioId, competencia);
    });
  });

  describe('delete', () => {
    it('exclui um lançamento próprio e recalcula a apuração', async () => {
      const { service, prisma, apuracaoService } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (prisma.livroCaixaLancamento.findUnique as jest.Mock).mockResolvedValue({
        id: 'lc-1',
        usuarioId,
        competencia,
      });

      await service.delete(usuarioId, 'lc-1');

      expect(prisma.livroCaixaLancamento.delete).toHaveBeenCalledWith({ where: { id: 'lc-1' } });
      expect(apuracaoService.recalcular).toHaveBeenCalledWith(usuarioId, competencia);
    });

    it('lança NotFoundException ao excluir lançamento de outro usuário', async () => {
      const { service, prisma, apuracaoService } = buildService();
      (prisma.livroCaixaLancamento.findUnique as jest.Mock).mockResolvedValue({
        id: 'lc-1',
        usuarioId: 'outro-usuario',
        competencia: new Date(),
      });

      await expect(service.delete(usuarioId, 'lc-1')).rejects.toThrow(NotFoundException);
      expect(prisma.livroCaixaLancamento.delete).not.toHaveBeenCalled();
      expect(apuracaoService.recalcular).not.toHaveBeenCalled();
    });
  });
});
