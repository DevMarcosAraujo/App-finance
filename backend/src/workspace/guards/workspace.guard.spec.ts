import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { WorkspaceGuard } from './workspace.guard';
import { WorkspaceService } from '../workspace.service';

describe('WorkspaceGuard', () => {
  const buildContext = (request: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as unknown as ExecutionContext;

  it('attaches the workspace to the request and allows access', async () => {
    const workspaceService = {
      findMine: jest.fn().mockResolvedValue({
        id: 'ws-1',
        nome: 'Financeiro de Marcos',
        plano: { tipo: 'INDIVIDUAL' },
      }),
    } as unknown as WorkspaceService;
    const guard = new WorkspaceGuard(workspaceService);
    const request: Record<string, unknown> = { user: { id: 'user-1' } };
    const context = buildContext(request);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.workspace).toEqual({
      id: 'ws-1',
      nome: 'Financeiro de Marcos',
      plano: { tipo: 'INDIVIDUAL' },
    });
    expect(workspaceService.findMine).toHaveBeenCalledWith('user-1');
  });

  it('throws ForbiddenException when the user has no workspace', async () => {
    const workspaceService = {
      findMine: jest.fn().mockResolvedValue(null),
    } as unknown as WorkspaceService;
    const guard = new WorkspaceGuard(workspaceService);
    const request = { user: { id: 'user-1' } };
    const context = buildContext(request);

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
