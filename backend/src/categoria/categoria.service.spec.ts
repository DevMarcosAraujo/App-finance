import { CategoriaService } from './categoria.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CategoriaService', () => {
  const buildService = () => {
    const prisma = {
      categoria: {
        count: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 10 }),
        findMany: jest.fn(),
      },
    } as unknown as PrismaService;

    return { service: new CategoriaService(prisma), prisma };
  };

  describe('findAll', () => {
    it('seeds the default categorias when none exist', async () => {
      const { service, prisma } = buildService();
      (prisma.categoria.count as jest.Mock).mockResolvedValue(0);
      (prisma.categoria.findMany as jest.Mock).mockResolvedValue([]);

      await service.findAll();

      expect(prisma.categoria.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ nome: 'Salário', sistema: true }),
          expect.objectContaining({ nome: 'Outros', sistema: true }),
        ]),
      });
    });

    it('does not reseed when categorias already exist', async () => {
      const { service, prisma } = buildService();
      (prisma.categoria.count as jest.Mock).mockResolvedValue(10);
      (prisma.categoria.findMany as jest.Mock).mockResolvedValue([]);

      await service.findAll();

      expect(prisma.categoria.createMany).not.toHaveBeenCalled();
    });

    it('returns only system categorias, ordered by nome', async () => {
      const { service, prisma } = buildService();
      (prisma.categoria.count as jest.Mock).mockResolvedValue(10);
      (prisma.categoria.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'cat-1',
          nome: 'Alimentação',
          cor: '#F97316',
          icone: null,
          sistema: true,
        },
      ]);

      const result = await service.findAll();

      expect(prisma.categoria.findMany).toHaveBeenCalledWith({
        where: { sistema: true },
        orderBy: { nome: 'asc' },
      });
      expect(result).toEqual([
        { id: 'cat-1', nome: 'Alimentação', cor: '#F97316', icone: null },
      ]);
    });
  });
});
