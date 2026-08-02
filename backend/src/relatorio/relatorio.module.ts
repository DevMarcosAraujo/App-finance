import { Module } from '@nestjs/common';
import { WorkspaceModule } from '../workspace/workspace.module';
import { RelatorioController } from './relatorio.controller';
import { RelatorioService } from './relatorio.service';

@Module({
  imports: [WorkspaceModule],
  controllers: [RelatorioController],
  providers: [RelatorioService],
})
export class RelatorioModule {}
