import { RendimentoAutonomoController } from './rendimento-autonomo.controller';
import { RendimentoAutonomoService } from './rendimento-autonomo.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('RendimentoAutonomoController', () => {
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
    } as unknown as RendimentoAutonomoService;
    return { controller: new RendimentoAutonomoController(service), service };
  };

  it('delegates create com o usuário atual', async () => {
    const { controller, service } = buildController();
    const dto = { tipo: 'HONORARIO' as const, fontePagadoraCpf: '11144477735', valorBruto: 1500, competencia: '2026-07-15' };
    (service.create as jest.Mock).mockResolvedValue({ id: 'r-1' });

    await controller.create(dto, user);

    expect(service.create).toHaveBeenCalledWith(user.id, dto);
  });

  it('delegates findByMonth com o usuário atual', async () => {
    const { controller, service } = buildController();
    (service.findByMonth as jest.Mock).mockResolvedValue([]);

    await controller.findByMonth(2026, 7, user);

    expect(service.findByMonth).toHaveBeenCalledWith(user.id, 2026, 7);
  });

  it('delegates update com o usuário atual', async () => {
    const { controller, service } = buildController();
    (service.update as jest.Mock).mockResolvedValue({ id: 'r-1' });

    await controller.update('r-1', { valorBruto: 2000 }, user);

    expect(service.update).toHaveBeenCalledWith(user.id, 'r-1', { valorBruto: 2000 });
  });

  it('delegates delete com o usuário atual', async () => {
    const { controller, service } = buildController();
    (service.delete as jest.Mock).mockResolvedValue(undefined);

    await controller.delete('r-1', user);

    expect(service.delete).toHaveBeenCalledWith(user.id, 'r-1');
  });
});
