import { NotFoundException } from '@nestjs/common';
import { RegimeEmpresa } from '@prisma/client';
import { FaturamentoMensalPjService } from './faturamento-mensal-pj.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmpresaService } from './empresa.service';
import { RBT12Service } from './rbt12.service';
import { DASApuracaoService } from './das-apuracao.service';
import { AcompanhamentoLimiteMeiService } from './acompanhamento-limite-mei.service';

describe('FaturamentoMensalPjService', () => {
  const usuarioId = 'user-1';
  const empresaId = 'e-1';

  const buildService = () => {
    const prisma = {
      empresa: { findUniqueOrThrow: jest.fn() },
      faturamentoMensalPJ: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      rBT12Cache: { findMany: jest.fn().mockResolvedValue([]) },
      dASApuracao: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    const empresaService = { findOwned: jest.fn() } as unknown as EmpresaService;
    const rbt12Service = { recalcular: jest.fn() } as unknown as RBT12Service;
    const dasApuracaoService = { recalcular: jest.fn() } as unknown as DASApuracaoService;
    const acompanhamentoLimiteMeiService = {
      recalcular: jest.fn(),
    } as unknown as AcompanhamentoLimiteMeiService;

    return {
      service: new FaturamentoMensalPjService(
        prisma,
        empresaService,
        rbt12Service,
        dasApuracaoService,
        acompanhamentoLimiteMeiService,
      ),
      prisma,
      empresaService,
      rbt12Service,
      dasApuracaoService,
      acompanhamentoLimiteMeiService,
    };
  };

  describe('create', () => {
    it('faz upsert e dispara a cascata completa (RBT12 -> DAS -> limite MEI) pra empresa SIMPLES_ME', async () => {
      const { service, prisma, empresaService, rbt12Service, dasApuracaoService, acompanhamentoLimiteMeiService } =
        buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (empresaService.findOwned as jest.Mock).mockResolvedValue({ id: empresaId });
      (prisma.faturamentoMensalPJ.upsert as jest.Mock).mockResolvedValue({
        id: 'f-1',
        empresaId,
        competencia,
        receitaBrutaTotal: '10000',
        receitaComNota: null,
        receitaSemNota: null,
        clienteTipoPredominante: null,
      });
      (prisma.empresa.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        regime: RegimeEmpresa.SIMPLES_ME,
      });

      await service.create(usuarioId, {
        empresaId,
        receitaBrutaTotal: 10000,
        competencia: '2026-07-15',
      });

      expect(empresaService.findOwned).toHaveBeenCalledWith(usuarioId, empresaId);
      expect(prisma.faturamentoMensalPJ.upsert).toHaveBeenCalledWith({
        where: { empresaId_competencia: { empresaId, competencia } },
        create: expect.objectContaining({ empresaId, competencia, receitaBrutaTotal: 10000 }),
        update: expect.objectContaining({ receitaBrutaTotal: 10000 }),
      });
      expect(rbt12Service.recalcular).toHaveBeenCalledWith(empresaId, competencia);
      expect(dasApuracaoService.recalcular).toHaveBeenCalledWith(empresaId, competencia);
      expect(acompanhamentoLimiteMeiService.recalcular).not.toHaveBeenCalled();
    });

    it('não chama RBT12Service pra empresa MEI, mas chama o limite MEI', async () => {
      const { service, prisma, empresaService, rbt12Service, dasApuracaoService, acompanhamentoLimiteMeiService } =
        buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (empresaService.findOwned as jest.Mock).mockResolvedValue({ id: empresaId });
      (prisma.faturamentoMensalPJ.upsert as jest.Mock).mockResolvedValue({
        id: 'f-1',
        empresaId,
        competencia,
        receitaBrutaTotal: '5000',
        receitaComNota: null,
        receitaSemNota: null,
        clienteTipoPredominante: null,
      });
      (prisma.empresa.findUniqueOrThrow as jest.Mock).mockResolvedValue({ regime: RegimeEmpresa.MEI });

      await service.create(usuarioId, {
        empresaId,
        receitaBrutaTotal: 5000,
        competencia: '2026-07-15',
      });

      expect(rbt12Service.recalcular).not.toHaveBeenCalled();
      expect(dasApuracaoService.recalcular).toHaveBeenCalledWith(empresaId, competencia);
      expect(acompanhamentoLimiteMeiService.recalcular).toHaveBeenCalledWith(empresaId, 2026);
    });
  });

  describe('update', () => {
    it('lança NotFoundException ao editar faturamento de empresa de outro usuário', async () => {
      const { service, prisma } = buildService();
      (prisma.faturamentoMensalPJ.findUnique as jest.Mock).mockResolvedValue({
        id: 'f-1',
        empresaId,
        competencia: new Date(),
        empresa: { usuarioId: 'outro-usuario' },
      });

      await expect(service.update(usuarioId, 'f-1', { receitaBrutaTotal: 1 })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.faturamentoMensalPJ.update).not.toHaveBeenCalled();
    });

    it('recalcula também os meses seguintes que já têm RBT12/DAS calculados', async () => {
      const { service, prisma, rbt12Service, dasApuracaoService } = buildService();
      const competenciaMes1 = new Date(Date.UTC(2026, 0, 1)); // janeiro/2026
      const competenciaMes2 = new Date(Date.UTC(2026, 1, 1)); // fevereiro/2026

      (prisma.faturamentoMensalPJ.findUnique as jest.Mock).mockResolvedValue({
        id: 'f-1',
        empresaId,
        competencia: competenciaMes1,
        empresa: { usuarioId },
      });
      (prisma.faturamentoMensalPJ.update as jest.Mock).mockResolvedValue({
        id: 'f-1',
        empresaId,
        competencia: competenciaMes1,
        receitaBrutaTotal: '20000',
        receitaComNota: null,
        receitaSemNota: null,
        clienteTipoPredominante: null,
      });
      (prisma.empresa.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        regime: RegimeEmpresa.SIMPLES_ME,
      });
      // fevereiro/2026 já tem DASApuracao (calculado com RBT12 que incluía janeiro)
      (prisma.dASApuracao.findMany as jest.Mock).mockResolvedValue([
        { competencia: competenciaMes2 },
      ]);
      (prisma.rBT12Cache.findMany as jest.Mock).mockResolvedValue([]);

      await service.update(usuarioId, 'f-1', { receitaBrutaTotal: 20000 });

      expect(rbt12Service.recalcular).toHaveBeenNthCalledWith(1, empresaId, competenciaMes1);
      expect(dasApuracaoService.recalcular).toHaveBeenNthCalledWith(1, empresaId, competenciaMes1);
      expect(rbt12Service.recalcular).toHaveBeenNthCalledWith(2, empresaId, competenciaMes2);
      expect(dasApuracaoService.recalcular).toHaveBeenNthCalledWith(2, empresaId, competenciaMes2);
      expect(prisma.dASApuracao.findMany).toHaveBeenCalledWith({
        where: {
          empresaId,
          competencia: { gt: competenciaMes1, lte: new Date(Date.UTC(2026, 11, 1)) },
        },
        select: { competencia: true },
      });
    });
  });

  describe('delete', () => {
    it('exclui e recalcula a cascata refletindo a remoção', async () => {
      const { service, prisma, dasApuracaoService } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (prisma.faturamentoMensalPJ.findUnique as jest.Mock).mockResolvedValue({
        id: 'f-1',
        empresaId,
        competencia,
        empresa: { usuarioId },
      });
      (prisma.empresa.findUniqueOrThrow as jest.Mock).mockResolvedValue({ regime: RegimeEmpresa.MEI });

      await service.delete(usuarioId, 'f-1');

      expect(prisma.faturamentoMensalPJ.delete).toHaveBeenCalledWith({ where: { id: 'f-1' } });
      expect(dasApuracaoService.recalcular).toHaveBeenCalledWith(empresaId, competencia);
    });
  });
});
