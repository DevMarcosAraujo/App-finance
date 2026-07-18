import { BadRequestException } from '@nestjs/common';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';
import { PrismaService } from '../prisma/prisma.service';
import { ParametroFiscalPfService } from './parametro-fiscal-pf.service';

describe('ApuracaoCarneLeaoService', () => {
  const usuarioId = 'user-1';

  // Valores de teste ilustrativos — não são os valores oficiais de 2026.
  const parametroTeste = {
    anoCalendario: 2026,
    faixaIsencaoMensal: 2000,
    faixaReducaoAte: 3000,
    tetoEducacaoAnual: 3561.5,
    valorDependenteMensal: 189.59,
    descontoSimplificadoMensal: 500,
    limiteObrigatoriedadeDeclaracao: 35584,
    tabelaProgressivaMensal: [
      { ate: 2000, aliquota: 0, parcelaDeduzir: 0 },
      { ate: 3000, aliquota: 0.1, parcelaDeduzir: 100 },
      { ate: 999999999, aliquota: 0.2, parcelaDeduzir: 400 },
    ],
  };

  const buildService = () => {
    const prisma = {
      rendimentoAutonomo: { findMany: jest.fn().mockResolvedValue([]) },
      deducaoCarneLeao: { findMany: jest.fn().mockResolvedValue([]) },
      livroCaixaLancamento: { findMany: jest.fn().mockResolvedValue([]) },
      apuracaoMensalCarneLeao: {
        upsert: jest.fn(({ create }: { create: unknown }) => ({ id: 'ap-1', ...(create as object) })),
        findUnique: jest.fn(),
      },
    } as unknown as PrismaService;

    const parametroFiscalPfService = {
      buscarPorAno: jest.fn().mockResolvedValue(parametroTeste),
    } as unknown as ParametroFiscalPfService;

    return {
      service: new ApuracaoCarneLeaoService(prisma, parametroFiscalPfService),
      prisma,
      parametroFiscalPfService,
    };
  };

  describe('recalcular', () => {
    it('isento quando a base de cálculo não passa a faixa de isenção', async () => {
      const { service, prisma } = buildService();
      (prisma.rendimentoAutonomo.findMany as jest.Mock).mockResolvedValue([{ valorBruto: '1500' }]);

      const result = await service.recalcular(usuarioId, new Date('2026-01-15'));

      expect(result.baseCalculo).toBe(1000); // 1500 - max(0, 500)
      expect(result.impostoDevido).toBe(0);
      expect(result.calculoIncerto).toBe(false);
    });

    it('aplica a tabela sem redutor e marca calculoIncerto na faixa 2000-3000', async () => {
      const { service, prisma } = buildService();
      (prisma.rendimentoAutonomo.findMany as jest.Mock).mockResolvedValue([{ valorBruto: '3000' }]);
      (prisma.deducaoCarneLeao.findMany as jest.Mock).mockResolvedValue([{ valor: '200' }]);

      const result = await service.recalcular(usuarioId, new Date('2026-01-15'));

      expect(result.baseCalculo).toBe(2500); // 3000 - max(200, 500)
      expect(result.impostoDevido).toBe(150); // 2500*0.10 - 100
      expect(result.calculoIncerto).toBe(true);
    });

    it('usa a dedução detalhada quando ela é maior que o desconto simplificado', async () => {
      const { service, prisma } = buildService();
      (prisma.rendimentoAutonomo.findMany as jest.Mock).mockResolvedValue([{ valorBruto: '6000' }]);
      (prisma.deducaoCarneLeao.findMany as jest.Mock).mockResolvedValue([{ valor: '1000' }]);

      const result = await service.recalcular(usuarioId, new Date('2026-01-15'));

      expect(result.baseCalculo).toBe(5000); // 6000 - max(1000, 500)
      expect(result.impostoDevido).toBe(600); // 5000*0.20 - 400
      expect(result.calculoIncerto).toBe(false);
    });

    it('usa o desconto simplificado quando as deduções detalhadas são menores', async () => {
      const { service, prisma } = buildService();
      (prisma.rendimentoAutonomo.findMany as jest.Mock).mockResolvedValue([{ valorBruto: '6000' }]);
      (prisma.deducaoCarneLeao.findMany as jest.Mock).mockResolvedValue([{ valor: '200' }]);

      const result = await service.recalcular(usuarioId, new Date('2026-01-15'));

      expect(result.baseCalculo).toBe(5500); // 6000 - max(200, 500)
      expect(result.impostoDevido).toBe(700); // 5500*0.20 - 400
    });

    it('soma os lançamentos de livro-caixa na dedução detalhada', async () => {
      const { service, prisma } = buildService();
      (prisma.rendimentoAutonomo.findMany as jest.Mock).mockResolvedValue([{ valorBruto: '6000' }]);
      (prisma.deducaoCarneLeao.findMany as jest.Mock).mockResolvedValue([{ valor: '100' }]);
      (prisma.livroCaixaLancamento.findMany as jest.Mock).mockResolvedValue([{ valor: '700' }]);

      const result = await service.recalcular(usuarioId, new Date('2026-01-15'));

      expect(result.baseCalculo).toBe(5200); // 6000 - max(100+700, 500)
      expect(result.impostoDevido).toBe(640); // 5200*0.20 - 400
    });

    it('recua o vencimento de sábado para sexta-feira', async () => {
      const { service } = buildService();

      const result = await service.recalcular(usuarioId, new Date('2026-01-15'));

      // competência janeiro/2026 -> vencimento seria 28/02/2026 (sábado) -> recua para 27/02/2026
      expect(result.vencimento.toISOString().slice(0, 10)).toBe('2026-02-27');
    });

    it('recua o vencimento de domingo para sexta-feira', async () => {
      const { service } = buildService();

      const result = await service.recalcular(usuarioId, new Date('2026-04-15'));

      // competência abril/2026 -> vencimento seria 31/05/2026 (domingo) -> recua para 29/05/2026
      expect(result.vencimento.toISOString().slice(0, 10)).toBe('2026-05-29');
    });

    it('mantém o vencimento quando já cai em dia útil', async () => {
      const { service } = buildService();

      const result = await service.recalcular(usuarioId, new Date('2026-06-15'));

      // competência junho/2026 -> vencimento 31/07/2026 (sexta-feira) -> sem recuo
      expect(result.vencimento.toISOString().slice(0, 10)).toBe('2026-07-31');
    });

    it('propaga o erro quando o parâmetro fiscal do ano não existe', async () => {
      const { service, parametroFiscalPfService } = buildService();
      (parametroFiscalPfService.buscarPorAno as jest.Mock).mockRejectedValue(
        new Error('parâmetro fiscal do ano 2099 não cadastrado'),
      );

      await expect(service.recalcular(usuarioId, new Date('2099-01-15'))).rejects.toThrow(
        'parâmetro fiscal do ano 2099 não cadastrado',
      );
    });
  });

  describe('buscarPorMes', () => {
    it('retorna null quando não existe apuração para o mês', async () => {
      const { service, prisma } = buildService();
      (prisma.apuracaoMensalCarneLeao.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.buscarPorMes(usuarioId, 2026, 7);

      expect(result).toBeNull();
    });

    it('rejeita um mes fora do intervalo 1-12', async () => {
      const { service } = buildService();

      await expect(service.buscarPorMes(usuarioId, 2026, 13)).rejects.toThrow(BadRequestException);
    });
  });
});
