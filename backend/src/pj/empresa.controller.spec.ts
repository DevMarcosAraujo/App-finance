import { EmpresaController } from './empresa.controller';
import { EmpresaService } from './empresa.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('EmpresaController', () => {
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
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as EmpresaService;
    return { controller: new EmpresaController(service), service };
  };

  it('delegates create com o usuário atual', async () => {
    const { controller, service } = buildController();
    const dto = {
      cnpj: '11222333000181',
      nome: 'Empresa',
      regime: 'MEI',
      atividadeTipo: 'SERVICO',
      dataAbertura: '2026-08-01',
    } as never;
    (service.create as jest.Mock).mockResolvedValue({ id: 'e-1' });

    await controller.create(dto, user);

    expect(service.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('delegates findAll com o usuário atual', async () => {
    const { controller, service } = buildController();
    (service.findAll as jest.Mock).mockResolvedValue([]);

    await controller.findAll(user);

    expect(service.findAll).toHaveBeenCalledWith('user-1');
  });

  it('delegates delete com o usuário atual', async () => {
    const { controller, service } = buildController();
    (service.delete as jest.Mock).mockResolvedValue(undefined);

    await controller.delete('e-1', user);

    expect(service.delete).toHaveBeenCalledWith('user-1', 'e-1');
  });
});
