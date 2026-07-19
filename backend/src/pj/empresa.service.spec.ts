import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RegimeEmpresa } from '@prisma/client';
import { EmpresaService } from './empresa.service';
import { PrismaService } from '../prisma/prisma.service';

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
    } as unknown as PrismaService;
    return { service: new EmpresaService(prisma), prisma };
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
