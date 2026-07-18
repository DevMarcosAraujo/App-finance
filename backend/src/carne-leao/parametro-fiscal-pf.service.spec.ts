import { NotFoundException } from '@nestjs/common';
import { ParametroFiscalPfService, ParametroFiscalPfDados } from './parametro-fiscal-pf.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ParametroFiscalPfService', () => {
  const dadosTeste: ParametroFiscalPfDados = {
    faixaIsencaoMensal: 2000,
    faixaReducaoAte: 3000,
    tetoEducacaoAnual: 3561.5,
    valorDependenteMensal: 189.59,
    descontoSimplificadoMensal: 500,
    limiteObrigatoriedadeDeclaracao: 35584,
    tabelaProgressivaMensal: [{ ate: 999999999, aliquota: 0.2, parcelaDeduzir: 400 }],
  };

  const buildService = () => {
    const prisma = {
      parametroFiscalPF: { findUnique: jest.fn(), create: jest.fn() },
    } as unknown as PrismaService;
    return { service: new ParametroFiscalPfService(prisma), prisma };
  };

  describe('ensureSeed', () => {
    it('cria o parâmetro quando não existe ainda para o ano', async () => {
      const { service, prisma } = buildService();
      (prisma.parametroFiscalPF.findUnique as jest.Mock).mockResolvedValue(null);

      await service.ensureSeed(2026, dadosTeste);

      expect(prisma.parametroFiscalPF.create).toHaveBeenCalledWith({
        data: { anoCalendario: 2026, ...dadosTeste },
      });
    });

    it('não recria o parâmetro quando já existe para o ano (idempotente)', async () => {
      const { service, prisma } = buildService();
      (prisma.parametroFiscalPF.findUnique as jest.Mock).mockResolvedValue({
        anoCalendario: 2026,
      });

      await service.ensureSeed(2026, dadosTeste);

      expect(prisma.parametroFiscalPF.create).not.toHaveBeenCalled();
    });
  });

  describe('buscarPorAno', () => {
    it('retorna o parâmetro convertido para number quando existe', async () => {
      const { service, prisma } = buildService();
      (prisma.parametroFiscalPF.findUnique as jest.Mock).mockResolvedValue({
        anoCalendario: 2026,
        faixaIsencaoMensal: '2000',
        faixaReducaoAte: '3000',
        tetoEducacaoAnual: '3561.5',
        valorDependenteMensal: '189.59',
        descontoSimplificadoMensal: '500',
        limiteObrigatoriedadeDeclaracao: '35584',
        tabelaProgressivaMensal: dadosTeste.tabelaProgressivaMensal,
      });

      const result = await service.buscarPorAno(2026);

      expect(result.faixaIsencaoMensal).toBe(2000);
      expect(typeof result.faixaIsencaoMensal).toBe('number');
      expect(result.tabelaProgressivaMensal).toEqual(dadosTeste.tabelaProgressivaMensal);
    });

    it('lança NotFoundException quando o ano não está cadastrado', async () => {
      const { service, prisma } = buildService();
      (prisma.parametroFiscalPF.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.buscarPorAno(2099)).rejects.toThrow(NotFoundException);
    });
  });
});
