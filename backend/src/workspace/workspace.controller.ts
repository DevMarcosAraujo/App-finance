import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import type { WorkspaceResult } from './workspace.service';
import { WorkspaceService } from './workspace.service';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  create(
    @Body() dto: CreateWorkspaceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WorkspaceResult> {
    return this.workspaceService.create(user.id, user.nome, dto.tipo);
  }

  @Get('me')
  async findMine(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WorkspaceResult> {
    const workspace = await this.workspaceService.findMine(user.id);
    if (!workspace) {
      throw new NotFoundException('usuário ainda não tem workspace');
    }
    return workspace;
  }
}
