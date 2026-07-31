import { ProLaboreController } from './pro-labore.controller';
import { ProLaboreService } from './pro-labore.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('ProLaboreController', () => {
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
    } as unknown as ProLaboreService;
    return { controller: new ProLaboreController(service), service };
  };

  it('delegates create com o usuário atual', async () => {
    const { controller, service } = buildController();
    const dto = { empresaId: 'e-1', valor: 3000, inssRetido: 330, competencia: '2026-07-01' } as never;
    (service.create as jest.Mock).mockResolvedValue({ id: 'p-1' });

    await controller.create(dto, user);

    expect(service.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('delegates update com o usuário atual', async () => {
    const { controller, service } = buildController();
    (service.update as jest.Mock).mockResolvedValue({ id: 'p-1' });

    await controller.update('p-1', { valor: 4000 }, user);

    expect(service.update).toHaveBeenCalledWith('user-1', 'p-1', { valor: 4000 });
  });
});
