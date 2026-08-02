import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { CategoriaModule } from './categoria/categoria.module';
import { TransacaoModule } from './transacao/transacao.module';
import { CarneLeaoModule } from './carne-leao/carne-leao.module';
import { PjModule } from './pj/pj.module';
import { RelatorioModule } from './relatorio/relatorio.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WorkspaceModule,
    CategoriaModule,
    TransacaoModule,
    CarneLeaoModule,
    PjModule,
    RelatorioModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
