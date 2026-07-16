import { TransacaoTipo } from '@prisma/client';
import { TransacaoController } from './transacao.controller';
import { TransacaoService } from './transacao.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { WorkspaceResult } from '../workspace/workspace.service';

describe('TransacaoController', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    nome: 'Marcos',
    email: 'marcos@example.com',
    cpf: '11144477735',
    criadoEm: new Date(),
  };
  const workspace: WorkspaceResult = {
    id: 'ws-1',
    nome: 'Financeiro de Marcos',
    plano: { tipo: 'INDIVIDUAL' },
  };

  const buildController = () => {
    const transacaoService = {
      create: jest.fn(),
      findByMonth: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as TransacaoService;

    return {
      controller: new TransacaoController(transacaoService),
      transacaoService,
    };
  };

  it('delegates create with the current user and workspace ids', async () => {
    const { controller, transacaoService } = buildController();
    const dto = { tipo: TransacaoTipo.DESPESA, valor: 10, data: '2026-07-15' };
    (transacaoService.create as jest.Mock).mockResolvedValue({ id: 'tx-1' });

    await controller.create(dto, user, workspace);

    expect(transacaoService.create).toHaveBeenCalledWith(
      workspace.id,
      user.id,
      dto,
    );
  });

  it('delegates findByMonth with the workspace id', async () => {
    const { controller, transacaoService } = buildController();
    (transacaoService.findByMonth as jest.Mock).mockResolvedValue([]);

    await controller.findByMonth(2026, 7, workspace);

    expect(transacaoService.findByMonth).toHaveBeenCalledWith(
      workspace.id,
      2026,
      7,
    );
  });

  it('delegates update with the workspace id', async () => {
    const { controller, transacaoService } = buildController();
    (transacaoService.update as jest.Mock).mockResolvedValue({ id: 'tx-1' });

    await controller.update('tx-1', { descricao: 'novo' }, workspace);

    expect(transacaoService.update).toHaveBeenCalledWith(
      workspace.id,
      'tx-1',
      { descricao: 'novo' },
    );
  });

  it('delegates delete with the workspace id', async () => {
    const { controller, transacaoService } = buildController();
    (transacaoService.delete as jest.Mock).mockResolvedValue(undefined);

    await controller.delete('tx-1', workspace);

    expect(transacaoService.delete).toHaveBeenCalledWith(workspace.id, 'tx-1');
  });
});
