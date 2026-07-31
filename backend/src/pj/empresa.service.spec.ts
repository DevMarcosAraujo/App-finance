import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RegimeEmpresa } from '@prisma/client';
import { EmpresaService } from './empresa.service';
import { PrismaService } from '../prisma/prisma.service';
import { RBT12Service } from './rbt12.service';
import { DASApuracaoService } from './das-apuracao.service';

describe('EmpresaService', () => {
  const usuarioId = 'user-1';

  const buildService = () => {
    const prisma = {
      empresa: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      dASApuracao: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const rbt12Service = { recalcular: jest.fn() } as unknown as RBT12Service;
    const dasApuracaoService = { recalcular: jest.fn() } as unknown as DASApuracaoService;
    return {
      service: new EmpresaService(prisma, rbt12Service, dasApuracaoService),
      prisma,
      rbt12Service,
      dasApuracaoService,
    };
  };

  const rawEmpresa = {
    id: 'e-1',
    usuarioId,
    cnpj: '11222333000181',
    nome: 'Empresa Teste',
    regime: RegimeEmpresa.MEI,
    atividadeTipo: 'SERVICO',
    anexoSimples: null,
    dataAbertura: new Date('2026-08-01'),
    ativa: true,
  };

  describe('create', () => {
    it('cria uma empresa MEI sem anexoSimples', async () => {
      const { service, prisma } = buildService();
      (prisma.empresa.create as jest.Mock).mockResolvedValue(rawEmpresa);

      const result = await service.create(usuarioId, {
        cnpj: '11222333000181',
        nome: 'Empresa Teste',
        regime: RegimeEmpresa.MEI,
        atividadeTipo: 'SERVICO' as never,
        dataAbertura: '2026-08-01',
      });

      expect(prisma.empresa.create).toHaveBeenCalledWith({
        data: {
          usuarioId,
          cnpj: '11222333000181',
          nome: 'Empresa Teste',
          regime: RegimeEmpresa.MEI,
          atividadeTipo: 'SERVICO',
          anexoSimples: undefined,
          dataAbertura: new Date('2026-08-01'),
        },
      });
      expect(result.id).toBe('e-1');
    });

    it('rejeita anexoSimples presente quando regime é MEI', async () => {
      const { service } = buildService();

      await expect(
        service.create(usuarioId, {
          cnpj: '11222333000181',
          nome: 'Empresa Teste',
          regime: RegimeEmpresa.MEI,
          atividadeTipo: 'SERVICO' as never,
          anexoSimples: 'III' as never,
          dataAbertura: '2026-08-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOwned', () => {
    it('lança NotFoundException para empresa de outro usuário', async () => {
      const { service, prisma } = buildService();
      (prisma.empresa.findUnique as jest.Mock).mockResolvedValue({
        ...rawEmpresa,
        usuarioId: 'outro-usuario',
      });

      await expect(service.findOwned(usuarioId, 'e-1')).rejects.toThrow(NotFoundException);
    });

    it('lança NotFoundException quando a empresa não existe', async () => {
      const { service, prisma } = buildService();
      (prisma.empresa.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOwned(usuarioId, 'e-1')).rejects.toThrow(NotFoundException);
    });

    it('retorna a empresa quando pertence ao usuário', async () => {
      const { service, prisma } = buildService();
      (prisma.empresa.findUnique as jest.Mock).mockResolvedValue(rawEmpresa);

      const result = await service.findOwned(usuarioId, 'e-1');

      expect(result.id).toBe('e-1');
    });
  });

  describe('update', () => {
    it('recalcula o DAS de todas as apurações existentes ao mudar atividadeTipo de empresa MEI', async () => {
      const { service, prisma, rbt12Service, dasApuracaoService } = buildService();
      (prisma.empresa.findUnique as jest.Mock).mockResolvedValue(rawEmpresa);
      const empresaAtualizada = { ...rawEmpresa, atividadeTipo: 'COMERCIO' };
      (prisma.empresa.update as jest.Mock).mockResolvedValue(empresaAtualizada);
      const competencia1 = new Date(Date.UTC(2026, 0, 1));
      const competencia2 = new Date(Date.UTC(2026, 1, 1));
      (prisma.dASApuracao.findMany as jest.Mock).mockResolvedValue([
        { competencia: competencia1 },
        { competencia: competencia2 },
      ]);

      await service.update(usuarioId, 'e-1', { atividadeTipo: 'COMERCIO' as never });

      expect(prisma.dASApuracao.findMany).toHaveBeenCalledWith({
        where: { empresaId: 'e-1' },
        select: { competencia: true },
      });
      expect(dasApuracaoService.recalcular).toHaveBeenCalledWith('e-1', competencia1);
      expect(dasApuracaoService.recalcular).toHaveBeenCalledWith('e-1', competencia2);
      expect(rbt12Service.recalcular).not.toHaveBeenCalled();
    });

    it('recalcula RBT12 antes do DAS ao mudar anexoSimples de empresa SIMPLES_ME', async () => {
      const rawEmpresaSimples = { ...rawEmpresa, regime: RegimeEmpresa.SIMPLES_ME, anexoSimples: 'I' };
      const { service, prisma, rbt12Service, dasApuracaoService } = buildService();
      (prisma.empresa.findUnique as jest.Mock).mockResolvedValue(rawEmpresaSimples);
      const empresaAtualizada = { ...rawEmpresaSimples, anexoSimples: 'III' };
      (prisma.empresa.update as jest.Mock).mockResolvedValue(empresaAtualizada);
      const competencia = new Date(Date.UTC(2026, 0, 1));
      (prisma.dASApuracao.findMany as jest.Mock).mockResolvedValue([{ competencia }]);

      await service.update(usuarioId, 'e-1', { anexoSimples: 'III' as never });

      expect(rbt12Service.recalcular).toHaveBeenCalledWith('e-1', competencia);
      expect(dasApuracaoService.recalcular).toHaveBeenCalledWith('e-1', competencia);
    });

    it('não recalcula nada quando só o nome muda', async () => {
      const { service, prisma, rbt12Service, dasApuracaoService } = buildService();
      (prisma.empresa.findUnique as jest.Mock).mockResolvedValue(rawEmpresa);
      (prisma.empresa.update as jest.Mock).mockResolvedValue({ ...rawEmpresa, nome: 'Novo nome' });

      await service.update(usuarioId, 'e-1', { nome: 'Novo nome' });

      expect(prisma.dASApuracao.findMany).not.toHaveBeenCalled();
      expect(dasApuracaoService.recalcular).not.toHaveBeenCalled();
      expect(rbt12Service.recalcular).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('exclui uma empresa própria', async () => {
      const { service, prisma } = buildService();
      (prisma.empresa.findUnique as jest.Mock).mockResolvedValue(rawEmpresa);

      await service.delete(usuarioId, 'e-1');

      expect(prisma.empresa.delete).toHaveBeenCalledWith({ where: { id: 'e-1' } });
    });

    it('lança NotFoundException ao excluir empresa de outro usuário', async () => {
      const { service, prisma } = buildService();
      (prisma.empresa.findUnique as jest.Mock).mockResolvedValue({
        ...rawEmpresa,
        usuarioId: 'outro-usuario',
      });

      await expect(service.delete(usuarioId, 'e-1')).rejects.toThrow(NotFoundException);
      expect(prisma.empresa.delete).not.toHaveBeenCalled();
    });
  });
});
