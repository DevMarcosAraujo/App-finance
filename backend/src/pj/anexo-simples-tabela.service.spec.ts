import { NotFoundException } from '@nestjs/common';
import { AnexoSimples } from '@prisma/client';
import { AnexoSimplesTabelaService } from './anexo-simples-tabela.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AnexoSimplesTabelaService', () => {
  const buildService = () => {
    const prisma = {
      anexoSimplesTabela: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    } as unknown as PrismaService;
    return { service: new AnexoSimplesTabelaService(prisma), prisma };
  };

  const faixasTeste = [
    { rbt12Ate: 180000, aliquota: 0.06, parcelaDeduzir: 0 },
    { rbt12Ate: 360000, aliquota: 0.112, parcelaDeduzir: 9360 },
  ];

  describe('ensureSeed', () => {
    it('cria a tabela do anexo quando não existe', async () => {
      const { service, prisma } = buildService();
      (prisma.anexoSimplesTabela.findUnique as jest.Mock).mockResolvedValue(null);

      await service.ensureSeed(2026, AnexoSimples.III, faixasTeste);

      expect(prisma.anexoSimplesTabela.create).toHaveBeenCalledWith({
        data: { anoCalendario: 2026, anexo: AnexoSimples.III, faixas: faixasTeste },
      });
    });

    it('não cria de novo quando já existe (idempotente)', async () => {
      const { service, prisma } = buildService();
      (prisma.anexoSimplesTabela.findUnique as jest.Mock).mockResolvedValue({ id: 'x' });

      await service.ensureSeed(2026, AnexoSimples.III, faixasTeste);

      expect(prisma.anexoSimplesTabela.create).not.toHaveBeenCalled();
    });
  });

  describe('buscarFaixas', () => {
    it('lança NotFoundException quando o anexo não está cadastrado pro ano', async () => {
      const { service, prisma } = buildService();
      (prisma.anexoSimplesTabela.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.buscarFaixas(2026, AnexoSimples.III)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('retorna as faixas cadastradas', async () => {
      const { service, prisma } = buildService();
      (prisma.anexoSimplesTabela.findUnique as jest.Mock).mockResolvedValue({
        faixas: faixasTeste,
      });

      const result = await service.buscarFaixas(2026, AnexoSimples.III);

      expect(result).toEqual(faixasTeste);
    });
  });
});
