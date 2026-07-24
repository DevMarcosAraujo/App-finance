import { RegimeEmpresa } from '@prisma/client';
import { AcompanhamentoLimiteMeiService } from './acompanhamento-limite-mei.service';
import { PrismaService } from '../prisma/prisma.service';
import { ParametroFiscalPjService } from './parametro-fiscal-pj.service';

describe('AcompanhamentoLimiteMeiService', () => {
  const empresaId = 'e-1';

  const buildService = () => {
    const prisma = {
      empresa: { findUniqueOrThrow: jest.fn() },
      faturamentoMensalPJ: { findMany: jest.fn() },
      acompanhamentoLimiteMEI: { upsert: jest.fn(), findUnique: jest.fn() },
    } as unknown as PrismaService;

    const parametroFiscalPjService = {
      buscarPorAno: jest.fn(),
    } as unknown as ParametroFiscalPjService;

    return {
      service: new AcompanhamentoLimiteMeiService(prisma, parametroFiscalPjService),
      prisma,
      parametroFiscalPjService,
    };
  };

  describe('recalcular', () => {
    it('retorna null sem chamar o banco quando a empresa não é MEI', async () => {
      const { service, prisma } = buildService();
      (prisma.empresa.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        regime: RegimeEmpresa.SIMPLES_ME,
        dataAbertura: new Date(Date.UTC(2020, 0, 1)),
      });

      const result = await service.recalcular(empresaId, 2026);

      expect(result).toBeNull();
      expect(prisma.acompanhamentoLimiteMEI.upsert).not.toHaveBeenCalled();
    });

    it('calcula o limite proporcional para empresa aberta em julho (6 meses restantes)', async () => {
      const { service, prisma, parametroFiscalPjService } = buildService();
      (prisma.empresa.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        regime: RegimeEmpresa.MEI,
        dataAbertura: new Date(Date.UTC(2026, 6, 1)), // julho/2026
      });
      (parametroFiscalPjService.buscarPorAno as jest.Mock).mockResolvedValue({
        meiLimiteAnual: 81000,
      });
      (prisma.faturamentoMensalPJ.findMany as jest.Mock).mockResolvedValue([
        { receitaBrutaTotal: '10000' },
      ]);
      (prisma.acompanhamentoLimiteMEI.upsert as jest.Mock).mockImplementation(({ create }) =>
        Promise.resolve({ id: 'a-1', ...create }),
      );

      const result = await service.recalcular(empresaId, 2026);

      // 6 meses restantes (jul-dez) -> limiteProporcional = (81000/12)*6 = 40500
      expect(result?.limiteProporcional).toBe(40500);
      expect(result?.receitaAcumuladaAno).toBe(10000);
    });

    describe.each([
      { receita: 79999, esperado: 'ok' },
      { receita: 80000, esperado: 'atencao_80pct' },
      { receita: 100000, esperado: 'atencao_80pct' },
      { receita: 100001, esperado: 'excedeu_20pct' },
      { receita: 120000, esperado: 'excedeu_20pct' },
      { receita: 120001, esperado: 'excedeu_mais_20pct' },
    ])('faixas de alerta (limite proporcional = 100000)', ({ receita, esperado }) => {
      it(`receita acumulada ${receita} -> alerta "${esperado}"`, async () => {
        const { service, prisma, parametroFiscalPjService } = buildService();
        (prisma.empresa.findUniqueOrThrow as jest.Mock).mockResolvedValue({
          regime: RegimeEmpresa.MEI,
          dataAbertura: new Date(Date.UTC(2025, 0, 1)), // 12 meses de atividade em 2026
        });
        (parametroFiscalPjService.buscarPorAno as jest.Mock).mockResolvedValue({
          meiLimiteAnual: 100000,
        });
        (prisma.faturamentoMensalPJ.findMany as jest.Mock).mockResolvedValue([
          { receitaBrutaTotal: String(receita) },
        ]);
        (prisma.acompanhamentoLimiteMEI.upsert as jest.Mock).mockImplementation(({ create }) =>
          Promise.resolve({ id: 'a-1', ...create }),
        );

        const result = await service.recalcular(empresaId, 2026);

        expect(result?.alerta).toBe(esperado);
      });
    });
  });

  describe('buscarPorAno', () => {
    it('lança NotFoundException quando a empresa não é MEI', async () => {
      const { service, prisma } = buildService();
      (prisma.empresa.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        regime: RegimeEmpresa.SIMPLES_ME,
      });

      await expect(service.buscarPorAno(empresaId, 2026)).rejects.toThrow('MEI');
    });

    it('retorna null quando ainda não há dado calculado pro ano', async () => {
      const { service, prisma } = buildService();
      (prisma.empresa.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        regime: RegimeEmpresa.MEI,
      });
      (prisma.acompanhamentoLimiteMEI.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.buscarPorAno(empresaId, 2026);

      expect(result).toBeNull();
    });
  });
});
