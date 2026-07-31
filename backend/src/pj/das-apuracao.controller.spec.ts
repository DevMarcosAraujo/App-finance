import { DasApuracaoController } from './das-apuracao.controller';
import { DASApuracaoService } from './das-apuracao.service';
import { EmpresaService } from './empresa.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('DasApuracaoController', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    nome: 'Marcos',
    email: 'marcos@example.com',
    cpf: '11144477735',
    criadoEm: new Date(),
  };

  const buildController = () => {
    const service = { buscarPorMes: jest.fn() } as unknown as DASApuracaoService;
    const empresaService = { findOwned: jest.fn() } as unknown as EmpresaService;
    return { controller: new DasApuracaoController(service, empresaService), service, empresaService };
  };

  it('verifica posse da empresa antes de consultar o DAS', async () => {
    const { controller, service, empresaService } = buildController();
    (empresaService.findOwned as jest.Mock).mockResolvedValue({ id: 'e-1' });
    (service.buscarPorMes as jest.Mock).mockResolvedValue(null);

    await controller.buscarPorMes('e-1', 2026, 7, user);

    expect(empresaService.findOwned).toHaveBeenCalledWith('user-1', 'e-1');
    expect(service.buscarPorMes).toHaveBeenCalledWith('e-1', 2026, 7);
  });

  it('propaga o erro (empresa de outro usuário) sem chamar o service de DAS', async () => {
    const { controller, service, empresaService } = buildController();
    (empresaService.findOwned as jest.Mock).mockRejectedValue(new Error('empresa não encontrada'));

    await expect(controller.buscarPorMes('e-1', 2026, 7, user)).rejects.toThrow();
    expect(service.buscarPorMes).not.toHaveBeenCalled();
  });
});
