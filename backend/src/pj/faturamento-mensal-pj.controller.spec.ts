import { FaturamentoMensalPjController } from './faturamento-mensal-pj.controller';
import { FaturamentoMensalPjService } from './faturamento-mensal-pj.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('FaturamentoMensalPjController', () => {
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
    } as unknown as FaturamentoMensalPjService;
    return { controller: new FaturamentoMensalPjController(service), service };
  };

  it('delegates findByMonth com empresaId/ano/mes e o usuário atual', async () => {
    const { controller, service } = buildController();
    (service.findByMonth as jest.Mock).mockResolvedValue([]);

    await controller.findByMonth('e-1', 2026, 7, user);

    expect(service.findByMonth).toHaveBeenCalledWith('user-1', 'e-1', 2026, 7);
  });

  it('delegates delete com o usuário atual', async () => {
    const { controller, service } = buildController();
    (service.delete as jest.Mock).mockResolvedValue(undefined);

    await controller.delete('f-1', user);

    expect(service.delete).toHaveBeenCalledWith('user-1', 'f-1');
  });
});
