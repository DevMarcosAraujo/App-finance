import { LivroCaixaController } from './livro-caixa.controller';
import { LivroCaixaService } from './livro-caixa.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('LivroCaixaController', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    nome: 'Marcos',
    email: 'marcos@example.com',
    cpf: '11144477735',
    criadoEm: new Date(),
  };

  const buildController = () => {
    const service = {
      create: jest.fn(),
      findByMonth: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as LivroCaixaService;
    return { controller: new LivroCaixaController(service), service };
  };

  it('delegates create com o usuário atual', async () => {
    const { controller, service } = buildController();
    const dto = { descricao: 'material', categoria: 'material', valor: 100, competencia: '2026-07-15' };
    (service.create as jest.Mock).mockResolvedValue({ id: 'lc-1' });

    await controller.create(dto, user);

    expect(service.create).toHaveBeenCalledWith(user.id, dto);
  });

  it('delegates delete com o usuário atual', async () => {
    const { controller, service } = buildController();
    (service.delete as jest.Mock).mockResolvedValue(undefined);

    await controller.delete('lc-1', user);

    expect(service.delete).toHaveBeenCalledWith(user.id, 'lc-1');
  });
});
