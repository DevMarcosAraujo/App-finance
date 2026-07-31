import { AcompanhamentoLimiteMeiController } from './acompanhamento-limite-mei.controller';
import { AcompanhamentoLimiteMeiService } from './acompanhamento-limite-mei.service';
import { EmpresaService } from './empresa.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('AcompanhamentoLimiteMeiController', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    nome: 'Marcos',
    email: 'marcos@example.com',
    cpf: '11144477735',
    criadoEm: new Date(),
  };

  const buildController = () => {
    const service = { buscarPorAno: jest.fn() } as unknown as AcompanhamentoLimiteMeiService;
    const empresaService = { findOwned: jest.fn() } as unknown as EmpresaService;
    return {
      controller: new AcompanhamentoLimiteMeiController(service, empresaService),
      service,
      empresaService,
    };
  };

  it('verifica posse da empresa antes de consultar o limite MEI', async () => {
    const { controller, service, empresaService } = buildController();
    (empresaService.findOwned as jest.Mock).mockResolvedValue({ id: 'e-1' });
    (service.buscarPorAno as jest.Mock).mockResolvedValue(null);

    await controller.buscarPorAno('e-1', 2026, user);

    expect(empresaService.findOwned).toHaveBeenCalledWith('user-1', 'e-1');
    expect(service.buscarPorAno).toHaveBeenCalledWith('e-1', 2026);
  });
});
