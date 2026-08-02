import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../workspace/guards/workspace.guard';
import { CurrentWorkspace } from '../workspace/decorators/current-workspace.decorator';
import type { WorkspaceResult } from '../workspace/workspace.service';
import { GerarRelatorioDto } from './dto/gerar-relatorio.dto';
import { RelatorioService, RelatorioGeradoResult } from './relatorio.service';

@Controller('relatorios')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class RelatorioController {
  constructor(private readonly relatorioService: RelatorioService) {}

  @Post()
  gerar(
    @Body() dto: GerarRelatorioDto,
    @CurrentWorkspace() workspace: WorkspaceResult,
  ): Promise<RelatorioGeradoResult> {
    return this.relatorioService.gerar(workspace.id, {
      tipo: dto.tipo,
      periodoInicio: new Date(dto.periodoInicio),
      periodoFim: new Date(dto.periodoFim),
    });
  }

  @Get()
  listar(
    @CurrentWorkspace() workspace: WorkspaceResult,
  ): Promise<RelatorioGeradoResult[]> {
    return this.relatorioService.listar(workspace.id);
  }

  @Get(':id/arquivo')
  async baixarArquivo(
    @Param('id') id: string,
    @CurrentWorkspace() workspace: WorkspaceResult,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.relatorioService.buscarArquivo(workspace.id, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(buffer);
  }
}
