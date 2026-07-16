import { Module } from '@nestjs/common';
import { WorkspaceModule } from '../workspace/workspace.module';
import { TransacaoController } from './transacao.controller';
import { TransacaoService } from './transacao.service';

@Module({
  imports: [WorkspaceModule],
  controllers: [TransacaoController],
  providers: [TransacaoService],
})
export class TransacaoModule {}
