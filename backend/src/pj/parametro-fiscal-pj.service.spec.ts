import { NotFoundException } from '@nestjs/common';
import { ParametroFiscalPjService } from './parametro-fiscal-pj.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ParametroFiscalPjService', () => {
  const buildService = () => {
    const prisma = {
      parametroFiscalPJ: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    } as unknown as PrismaService;
    return { service: new ParametroFiscalPjService(prisma), prisma };
  };

  const dadosTeste = {
    meiLimiteAnual: 81000,
    meiDasComercioIndustria: 82.05,
    meiDasServicos: 86.05,
    meiDasComercioServicos: 87.05,
    limiteDividendoIsentoMensal: 50000,
    aliquotaDividendoExcedente: 0,
  };

  describe('ensureSeed', () => {
    it('cria o parâmetro quando não existe', async () => {
      const { service, prisma } = buildService();
      (prisma.parametroFiscalPJ.findUnique as jest.Mock).mockResolvedValue(null);

      await service.ensureSeed(2026, dadosTeste);

      expect(prisma.parametroFiscalPJ.create).toHaveBeenCalledWith({
        data: { anoCalendario: 2026, ...dadosTeste },
      });
    });

    it('não cria de novo quando já existe (idempotente)', async () => {
      const { service, prisma } = buildService();
      (prisma.parametroFiscalPJ.findUnique as jest.Mock).mockResolvedValue({ anoCalendario: 2026 });

      await service.ensureSeed(2026, dadosTeste);

      expect(prisma.parametroFiscalPJ.create).not.toHaveBeenCalled();
    });
  });

  describe('buscarPorAno', () => {
    it('lança NotFoundException quando o ano não está cadastrado', async () => {
      const { service, prisma } = buildService();
      (prisma.parametroFiscalPJ.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.buscarPorAno(2026)).rejects.toThrow(NotFoundException);
    });

    it('converte os campos Decimal para number', async () => {
      const { service, prisma } = buildService();
      (prisma.parametroFiscalPJ.findUnique as jest.Mock).mockResolvedValue({
        anoCalendario: 2026,
        meiLimiteAnual: '81000',
        meiDasComercioIndustria: '82.05',
        meiDasServicos: '86.05',
        meiDasComercioServicos: '87.05',
        limiteDividendoIsentoMensal: '50000',
        aliquotaDividendoExcedente: '0',
      });

      const result = await service.buscarPorAno(2026);

      expect(result.meiLimiteAnual).toBe(81000);
      expect(typeof result.meiLimiteAnual).toBe('number');
    });
  });
});
