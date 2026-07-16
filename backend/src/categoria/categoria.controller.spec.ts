import { CategoriaController } from './categoria.controller';
import { CategoriaService } from './categoria.service';

describe('CategoriaController', () => {
  it('delegates findAll to CategoriaService', async () => {
    const categorias = [
      { id: 'cat-1', nome: 'Alimentação', cor: '#F97316', icone: null },
    ];
    const categoriaService = {
      findAll: jest.fn().mockResolvedValue(categorias),
    } as unknown as CategoriaService;
    const controller = new CategoriaController(categoriaService);

    const result = await controller.findAll();

    expect(result).toEqual(categorias);
  });
});
