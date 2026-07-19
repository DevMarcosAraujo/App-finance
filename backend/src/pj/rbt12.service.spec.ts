import { RBT12Service } from './rbt12.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RBT12Service', () => {
  const empresaId = 'e-1';

  const buildService = () => {
    const prisma = {
      empresa: { findUniqueOrThrow: jest.fn() },
      faturamentoMensalPJ: { findMany: jest.fn() },
      rBT12Cache: { upsert: jest.fn() },
    } as unknown as PrismaService;
    return { service: new RBT12Service(prisma), prisma };
  };

  describe('recalcular', () => {
    it('usa a soma dos últimos 12 meses quando a empresa tem 12+ meses de atividade', async () => {
      const { service, prisma } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1)); // julho/2026
      (prisma.empresa.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        dataAbertura: new Date(Date.UTC(2020, 0, 1)), // bem antiga, 12+ meses
      });
      (prisma.faturamentoMensalPJ.findMany as jest.Mock).mockResolvedValue([
        { receitaBrutaTotal: '10000' },
        { receitaBrutaTotal: '20000' },
      ]);
      (prisma.rBT12Cache.upsert as jest.Mock).mockResolvedValue({
        id: 'r-1',
        empresaId,
        competencia,
        rbt12Calculado: '30000',
      });

      const result = await service.recalcular(empresaId, competencia);

      expect(prisma.faturamentoMensalPJ.findMany).toHaveBeenCalledWith({
        where: {
          empresaId,
          competencia: {
            gte: new Date(Date.UTC(2025, 7, 1)), // 11 meses antes de julho/2026 = agosto/2025
            lte: competencia,
          },
        },
      });
      expect(prisma.rBT12Cache.upsert).toHaveBeenCalledWith({
        where: { empresaId_competencia: { empresaId, competencia } },
        create: { empresaId, competencia, rbt12Calculado: 30000 },
        update: { rbt12Calculado: 30000 },
      });
      expect(result.rbt12Calculado).toBe(30000);
    });

    it('proporcionaliza a receita quando a empresa tem menos de 12 meses de atividade', async () => {
      const { service, prisma } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1)); // julho/2026
      (prisma.empresa.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        dataAbertura: new Date(Date.UTC(2026, 4, 1)), // maio/2026: 3 meses de atividade até julho
      });
      (prisma.faturamentoMensalPJ.findMany as jest.Mock).mockResolvedValue([
        { receitaBrutaTotal: '3000' },
        { receitaBrutaTotal: '3000' },
        { receitaBrutaTotal: '3000' },
      ]);
      (prisma.rBT12Cache.upsert as jest.Mock).mockResolvedValue({
        id: 'r-1',
        empresaId,
        competencia,
        rbt12Calculado: '36000',
      });

      await service.recalcular(empresaId, competencia);

      // soma = 9000, mesesAtividade = 3 (mai, jun, jul) -> (9000/3)*12 = 36000
      expect(prisma.rBT12Cache.upsert).toHaveBeenCalledWith({
        where: { empresaId_competencia: { empresaId, competencia } },
        create: { empresaId, competencia, rbt12Calculado: 36000 },
        update: { rbt12Calculado: 36000 },
      });
    });
  });
});
