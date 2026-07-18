import { DeducaoCarneLeaoController } from './deducao-carne-leao.controller';
import { DeducaoCarneLeaoService } from './deducao-carne-leao.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('DeducaoCarneLeaoController', () => {
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
    } as unknown as DeducaoCarneLeaoService;
    return { controller: new DeducaoCarneLeaoController(service), service };
  };

  it('delegates create com o usuário atual', async () => {
    const { controller, service } = buildController();
    const dto = { tipo: 'INSS_AUTONOMO' as const, valor: 500, competencia: '2026-07-15' };
    (service.create as jest.Mock).mockResolvedValue({ id: 'd-1' });

    await controller.create(dto, user);

    expect(service.create).toHaveBeenCalledWith(user.id, dto);
  });

  it('delegates delete com o usuário atual', async () => {
    const { controller, service } = buildController();
    (service.delete as jest.Mock).mockResolvedValue(undefined);

    await controller.delete('d-1', user);

    expect(service.delete).toHaveBeenCalledWith(user.id, 'd-1');
  });
});
