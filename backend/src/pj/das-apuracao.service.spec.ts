import { AnexoSimples, AtividadeEmpresa, RegimeEmpresa } from '@prisma/client';
import { DASApuracaoService } from './das-apuracao.service';
import { PrismaService } from '../prisma/prisma.service';
import { ParametroFiscalPjService } from './parametro-fiscal-pj.service';
import { AnexoSimplesTabelaService } from './anexo-simples-tabela.service';

describe('DASApuracaoService', () => {
  const empresaId = 'e-1';

  const buildService = () => {
    const prisma = {
      empresa: { findUniqueOrThrow: jest.fn() },
      faturamentoMensalPJ: { findUnique: jest.fn() },
      rBT12Cache: { findUnique: jest.fn() },
      dASApuracao: { upsert: jest.fn(), findUnique: jest.fn() },
    } as unknown as PrismaService;

    const parametroFiscalPjService = {
      buscarPorAno: jest.fn(),
    } as unknown as ParametroFiscalPjService;

    const anexoSimplesTabelaService = {
      buscarFaixas: jest.fn(),
    } as unknown as AnexoSimplesTabelaService;

    return {
      service: new DASApuracaoService(prisma, parametroFiscalPjService, anexoSimplesTabelaService),
      prisma,
      parametroFiscalPjService,
      anexoSimplesTabelaService,
    };
  };

  describe('recalcular — MEI', () => {
    it('usa o valor fixo tabelado, ignorando faturamento e RBT12', async () => {
      const { service, prisma, parametroFiscalPjService } = buildService();
      const competencia = new Date(Date.UTC(2026, 1, 1)); // fevereiro/2026
      (prisma.empresa.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        regime: RegimeEmpresa.MEI,
        atividadeTipo: AtividadeEmpresa.SERVICO,
        anexoSimples: null,
      });
      (prisma.faturamentoMensalPJ.findUnique as jest.Mock).mockResolvedValue(null);
      (parametroFiscalPjService.buscarPorAno as jest.Mock).mockResolvedValue({
        meiDasComercioIndustria: 82.05,
        meiDasServicos: 86.05,
        meiDasComercioServicos: 87.05,
      });
      (prisma.dASApuracao.upsert as jest.Mock).mockResolvedValue({
        id: 'd-1',
        competencia,
        regimeNoMomento: RegimeEmpresa.MEI,
        valorDevido: '86.05',
        detalheCalculo: { tipo: 'fixo', valorTabelado: 86.05 },
        vencimento: new Date('2026-03-20'),
        status: 'PENDENTE',
      });

      const result = await service.recalcular(empresaId, competencia);

      expect(prisma.dASApuracao.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ valorDevido: 86.05 }),
        }),
      );
      expect(result.valorDevido).toBe(86.05);
      expect(result.vencimento.toISOString().slice(0, 10)).toBe('2026-03-20');
    });
  });

  describe('recalcular — SIMPLES_ME', () => {
    it('calcula a alíquota efetiva a partir do RBT12 e da faixa do Anexo', async () => {
      const { service, prisma, anexoSimplesTabelaService } = buildService();
      const competencia = new Date(Date.UTC(2026, 7, 1)); // agosto/2026
      (prisma.empresa.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        regime: RegimeEmpresa.SIMPLES_ME,
        atividadeTipo: AtividadeEmpresa.SERVICO,
        anexoSimples: AnexoSimples.III,
      });
      (prisma.faturamentoMensalPJ.findUnique as jest.Mock).mockResolvedValue({
        receitaBrutaTotal: '10000',
      });
      (prisma.rBT12Cache.findUnique as jest.Mock).mockResolvedValue({ rbt12Calculado: '180000' });
      (anexoSimplesTabelaService.buscarFaixas as jest.Mock).mockResolvedValue([
        { rbt12Ate: 180000, aliquota: 0.06, parcelaDeduzir: 0 },
        { rbt12Ate: 360000, aliquota: 0.112, parcelaDeduzir: 9360 },
      ]);
      (prisma.dASApuracao.upsert as jest.Mock).mockResolvedValue({
        id: 'd-1',
        competencia,
        regimeNoMomento: RegimeEmpresa.SIMPLES_ME,
        valorDevido: '600',
        detalheCalculo: {},
        vencimento: new Date('2026-09-18'),
        status: 'PENDENTE',
      });

      const result = await service.recalcular(empresaId, competencia);

      // faixa até 180000, aliquota 6%, parcela 0 -> aliquotaEfetiva = (180000*0.06-0)/180000 = 0.06
      // valorDevido = 10000 * 0.06 = 600
      expect(prisma.dASApuracao.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ valorDevido: 600 }),
        }),
      );
      expect(result.valorDevido).toBe(600);
      // vencimento: competência agosto/2026 -> dia 20/09/2026 é domingo -> recua para 18/09/2026
      expect(result.vencimento.toISOString().slice(0, 10)).toBe('2026-09-18');
    });
  });

  describe('vencimento', () => {
    it('mantém o vencimento quando dia 20 do mês seguinte já é dia útil', async () => {
      const { service, prisma, parametroFiscalPjService } = buildService();
      const competencia = new Date(Date.UTC(2026, 1, 1)); // fevereiro/2026 -> vencimento 20/03/2026 (sexta)
      (prisma.empresa.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        regime: RegimeEmpresa.MEI,
        atividadeTipo: AtividadeEmpresa.COMERCIO,
        anexoSimples: null,
      });
      (prisma.faturamentoMensalPJ.findUnique as jest.Mock).mockResolvedValue(null);
      (parametroFiscalPjService.buscarPorAno as jest.Mock).mockResolvedValue({
        meiDasComercioIndustria: 82.05,
        meiDasServicos: 86.05,
        meiDasComercioServicos: 87.05,
      });
      (prisma.dASApuracao.upsert as jest.Mock).mockImplementation(({ create }) =>
        Promise.resolve({ id: 'd-1', ...create }),
      );

      const result = await service.recalcular(empresaId, competencia);

      expect(result.vencimento.toISOString().slice(0, 10)).toBe('2026-03-20');
    });
  });

  describe('buscarPorMes', () => {
    it('retorna null quando não há apuração calculada ainda', async () => {
      const { service, prisma } = buildService();
      (prisma.dASApuracao.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.buscarPorMes(empresaId, 2026, 8);

      expect(result).toBeNull();
    });
  });
});
