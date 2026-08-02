import { Response } from 'express';
import { TipoRelatorio } from '@prisma/client';
import { RelatorioController } from './relatorio.controller';
import { RelatorioService } from './relatorio.service';
import { WorkspaceResult } from '../workspace/workspace.service';

// Ver relatorio.service.spec.ts: `renderRelatorioPdf` depende de um pacote
// ESM puro que não roda no runtime de módulos do Jest, então mockamos aqui
// também para evitar que a cadeia de imports do controller quebre a suíte.
jest.mock('./relatorio.pdf', () => ({
  renderRelatorioPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake')),
}));

describe('RelatorioController', () => {
  const workspace: WorkspaceResult = {
    id: 'ws-1',
    nome: 'Financeiro de Marcos',
    plano: { tipo: 'INDIVIDUAL' },
  };

  const buildController = () => {
    const relatorioService = {
      gerar: jest.fn(),
      listar: jest.fn(),
      buscarArquivo: jest.fn(),
    } as unknown as RelatorioService;

    return {
      controller: new RelatorioController(relatorioService),
      relatorioService,
    };
  };

  it('delegates gerar with the workspace id and período convertido em Date', async () => {
    const { controller, relatorioService } = buildController();
    (relatorioService.gerar as jest.Mock).mockResolvedValue({ id: 'rel-1' });

    await controller.gerar(
      {
        tipo: TipoRelatorio.MENSAL,
        periodoInicio: '2026-07-01',
        periodoFim: '2026-08-01',
      },
      workspace,
    );

    expect(relatorioService.gerar).toHaveBeenCalledWith(workspace.id, {
      tipo: TipoRelatorio.MENSAL,
      periodoInicio: new Date('2026-07-01'),
      periodoFim: new Date('2026-08-01'),
    });
  });

  it('delegates listar with the workspace id', async () => {
    const { controller, relatorioService } = buildController();
    (relatorioService.listar as jest.Mock).mockResolvedValue([]);

    await controller.listar(workspace);

    expect(relatorioService.listar).toHaveBeenCalledWith(workspace.id);
  });

  it('delegates buscarArquivo and streams the PDF buffer', async () => {
    const { controller, relatorioService } = buildController();
    const buffer = Buffer.from('%PDF-fake');
    (relatorioService.buscarArquivo as jest.Mock).mockResolvedValue(buffer);
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as unknown as Response;

    await controller.baixarArquivo('rel-1', workspace, res);

    expect(relatorioService.buscarArquivo).toHaveBeenCalledWith(
      workspace.id,
      'rel-1',
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/pdf',
    );
    expect(res.send).toHaveBeenCalledWith(buffer);
  });
});
