import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { WorkspaceResult } from '../workspace.service';

export const CurrentWorkspace = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): WorkspaceResult => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ workspace: WorkspaceResult }>();
    return request.workspace;
  },
);
