import { DistribuicaoLucrosController } from './distribuicao-lucros.controller';
import { DistribuicaoLucrosService } from './distribuicao-lucros.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('DistribuicaoLucrosController', () => {
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
    } as unknown as DistribuicaoLucrosService;
    return { controller: new DistribuicaoLucrosController(service), service };
  };

  it('delegates create com o usuário atual', async () => {
    const { controller, service } = buildController();
    const dto = { empresaId: 'e-1', valor: 10000, competencia: '2026-07-01' } as never;
    (service.create as jest.Mock).mockResolvedValue({ id: 'dl-1' });

    await controller.create(dto, user);

    expect(service.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('delegates delete com o usuário atual', async () => {
    const { controller, service } = buildController();
    (service.delete as jest.Mock).mockResolvedValue(undefined);

    await controller.delete('dl-1', user);

    expect(service.delete).toHaveBeenCalledWith('user-1', 'dl-1');
  });
});
