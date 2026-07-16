import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../workspace/guards/workspace.guard';
import { CurrentWorkspace } from '../workspace/decorators/current-workspace.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import type { WorkspaceResult } from '../workspace/workspace.service';
import { CreateTransacaoDto } from './dto/create-transacao.dto';
import { UpdateTransacaoDto } from './dto/update-transacao.dto';
import type { TransacaoResult } from './transacao.service';
import { TransacaoService } from './transacao.service';

@Controller('transacoes')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class TransacaoController {
  constructor(private readonly transacaoService: TransacaoService) {}

  @Post()
  create(
    @Body() dto: CreateTransacaoDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceResult,
  ): Promise<TransacaoResult> {
    return this.transacaoService.create(workspace.id, user.id, dto);
  }

  @Get()
  findByMonth(
    @Query('ano', ParseIntPipe) ano: number,
    @Query('mes', ParseIntPipe) mes: number,
    @CurrentWorkspace() workspace: WorkspaceResult,
  ): Promise<TransacaoResult[]> {
    return this.transacaoService.findByMonth(workspace.id, ano, mes);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTransacaoDto,
    @CurrentWorkspace() workspace: WorkspaceResult,
  ): Promise<TransacaoResult> {
    return this.transacaoService.update(workspace.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @CurrentWorkspace() workspace: WorkspaceResult,
  ): Promise<void> {
    await this.transacaoService.delete(workspace.id, id);
  }
}
