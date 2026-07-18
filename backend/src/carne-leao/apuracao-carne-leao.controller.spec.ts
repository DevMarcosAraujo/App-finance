import { ApuracaoCarneLeaoController } from './apuracao-carne-leao.controller';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('ApuracaoCarneLeaoController', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    nome: 'Marcos',
    email: 'marcos@example.com',
    cpf: '11144477735',
    criadoEm: new Date(),
  };

  it('delegates buscarPorMes com o usuário atual', async () => {
    const service = { buscarPorMes: jest.fn().mockResolvedValue(null) } as unknown as ApuracaoCarneLeaoService;
    const controller = new ApuracaoCarneLeaoController(service);

    await controller.buscarPorMes(2026, 7, user);

    expect(service.buscarPorMes).toHaveBeenCalledWith(user.id, 2026, 7);
  });
});
