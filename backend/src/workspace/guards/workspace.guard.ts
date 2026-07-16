import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { WorkspaceService, WorkspaceResult } from '../workspace.service';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private readonly workspaceService: WorkspaceService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user: AuthenticatedUser;
      workspace?: WorkspaceResult;
    }>();

    const workspace = await this.workspaceService.findMine(request.user.id);
    if (!workspace) {
      throw new ForbiddenException('usuário não pertence a um workspace');
    }

    request.workspace = workspace;
    return true;
  }
}
