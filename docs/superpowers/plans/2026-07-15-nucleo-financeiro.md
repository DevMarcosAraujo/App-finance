# Núcleo Financeiro (Transações + Categorias) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Depois de ter um workspace, o usuário consegue lançar, listar (por mês, com navegação entre meses), editar e excluir transações (receitas/despesas), categorizadas por uma lista fixa de categorias do sistema.

**Architecture:** Dois módulos novos no NestJS (`CategoriaModule`, `TransacaoModule`) mais uma peça de infraestrutura compartilhada (`WorkspaceGuard`/`@CurrentWorkspace()` dentro do `WorkspaceModule` existente) que resolve o workspace do usuário autenticado, reaproveitável por qualquer módulo financeiro futuro. No Expo, um hook `useTransacoes` (leitura, escopado por mês) e funções assíncronas simples de mutação (`createTransacao`/`updateTransacao`/`deleteTransacao`), consumidos por duas telas: a Home (lista + navegação de mês) e uma tela de formulário separada (criar/editar), alcançável via `Stack` aninhado dentro do `(app)`.

**Tech Stack:** NestJS 11, Prisma 6 (nenhuma migration nova — `Transacao`/`Categoria` já existem no schema), Jest/Supertest, Expo/expo-router (mesmo padrão dos módulos de auth/onboarding já implementados).

## Global Constraints

- Nenhuma migration de schema nesta etapa — os models `Transacao`/`Categoria` já existem em `backend/prisma/schema.prisma`.
- Qualquer membro do workspace pode editar/excluir qualquer transação do workspace (não restrito a quem registrou).
- Só categorias do sistema (`sistema: true`) nesta etapa — sem CRUD de categoria própria.
- Seed fixo de 10 categorias: `Salário`, `Renda Extra`, `Alimentação`, `Transporte`, `Moradia`, `Saúde`, `Lazer`, `Educação`, `Compras`, `Outros`.
- `valor` sempre armazenado/retornado como magnitude positiva; o sinal (receita/despesa) vem do campo `tipo`, nunca do sinal do valor.
- Listagem por mês (`GET /transacoes?ano=&mes=`), com navegação entre meses no frontend — sem paginação nesta etapa.
- `WorkspaceGuard` roda depois do `JwtAuthGuard`; se o usuário autenticado não tiver workspace, bloqueia com `403` (defesa — não deve ocorrer na prática já que onboarding é obrigatório).
- Editar/excluir uma transação que pertence a outro workspace retorna `404` (não `403`) — não vaza que a transação existe em outro workspace.
- Todos os comandos `npm` assumem execução a partir da raiz do repositório (`/home/marcosebia/Documentos/Dev/Sistema-finance`), usando `npm run <script> -w backend` (ou `-w frontend`).
- Ambiente local: Postgres do projeto roda na porta **5433** (`backend/.env` já aponta pra lá).

---

### Task 1: `WorkspaceGuard` + `@CurrentWorkspace()`

**Files:**
- Create: `backend/src/workspace/guards/workspace.guard.ts`
- Test: `backend/src/workspace/guards/workspace.guard.spec.ts`
- Create: `backend/src/workspace/decorators/current-workspace.decorator.ts`
- Modify: `backend/src/workspace/workspace.module.ts`

**Interfaces:**
- Consumes: `WorkspaceService.findMine(usuarioId: string): Promise<WorkspaceResult | null>` (já existe).
- Produces: `WorkspaceGuard` (anexa `request.workspace: WorkspaceResult`), `CurrentWorkspace` decorator (extrai `request.workspace`).

- [ ] **Step 1: Escrever o teste do guard**

```ts
// backend/src/workspace/guards/workspace.guard.spec.ts
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
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test -w backend -- workspace.guard`
Expected: FAIL — `Cannot find module './workspace.guard'`.

- [ ] **Step 3: Implementar o guard**

```ts
// backend/src/workspace/guards/workspace.guard.ts
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
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test -w backend -- workspace.guard`
Expected: PASS (2 testes).

- [ ] **Step 5: Implementar o decorator**

```ts
// backend/src/workspace/decorators/current-workspace.decorator.ts
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
```

Não há teste unitário dedicado para o decorator — mesmo padrão do
`CurrentUser` (`backend/src/auth/decorators/current-user.decorator.ts`),
que também não tem `.spec.ts` próprio. É exercitado indiretamente pelo
teste e2e (Task 8), via uma requisição HTTP real.

- [ ] **Step 6: Exportar `WorkspaceService` e `WorkspaceGuard` do `WorkspaceModule`**

```ts
// backend/src/workspace/workspace.module.ts
import { Module } from '@nestjs/common';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { WorkspaceGuard } from './guards/workspace.guard';

@Module({
  controllers: [WorkspaceController],
  providers: [WorkspaceService, WorkspaceGuard],
  exports: [WorkspaceService, WorkspaceGuard],
})
export class WorkspaceModule {}
```

- [ ] **Step 7: Rodar toda a suíte unitária do backend**

Run: `npm run test -w backend`
Expected: todos os testes passam (incluindo os já existentes de auth/workspace).

- [ ] **Step 8: Commit**

```bash
git add backend/src/workspace/guards backend/src/workspace/decorators backend/src/workspace/workspace.module.ts
git commit -m "feat: adiciona WorkspaceGuard e @CurrentWorkspace()"
```

---

### Task 2: `CreateTransacaoDto` + `UpdateTransacaoDto`

**Files:**
- Create: `backend/src/transacao/dto/create-transacao.dto.ts`
- Test: `backend/src/transacao/dto/create-transacao.dto.spec.ts`
- Create: `backend/src/transacao/dto/update-transacao.dto.ts`
- Test: `backend/src/transacao/dto/update-transacao.dto.spec.ts`

**Interfaces:**
- Produces: `CreateTransacaoDto { tipo: TransacaoTipo; valor: number; categoriaId?: string; descricao?: string; data: string }`, `UpdateTransacaoDto` (mesmos campos, todos opcionais).

- [ ] **Step 1: Escrever os testes**

```ts
// backend/src/transacao/dto/create-transacao.dto.spec.ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTransacaoDto } from './create-transacao.dto';

describe('CreateTransacaoDto', () => {
  const valid = {
    tipo: 'DESPESA',
    valor: 42.5,
    data: '2026-07-15',
  };

  it('accepts a valid despesa without categoria/descricao', async () => {
    const dto = plainToInstance(CreateTransacaoDto, valid);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts a valid receita with categoria and descricao', async () => {
    const dto = plainToInstance(CreateTransacaoDto, {
      ...valid,
      tipo: 'RECEITA',
      categoriaId: '11111111-1111-1111-1111-111111111111',
      descricao: 'salário de julho',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an invalid tipo', async () => {
    const dto = plainToInstance(CreateTransacaoDto, {
      ...valid,
      tipo: 'INVALIDO',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'tipo')).toBe(true);
  });

  it('rejects a non-positive valor', async () => {
    const dto = plainToInstance(CreateTransacaoDto, { ...valid, valor: -10 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'valor')).toBe(true);
  });

  it('rejects an invalid categoriaId', async () => {
    const dto = plainToInstance(CreateTransacaoDto, {
      ...valid,
      categoriaId: 'not-a-uuid',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'categoriaId')).toBe(true);
  });

  it('rejects a missing data', async () => {
    const { data: _data, ...withoutData } = valid;
    const dto = plainToInstance(CreateTransacaoDto, withoutData);
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'data')).toBe(true);
  });
});
```

```ts
// backend/src/transacao/dto/update-transacao.dto.spec.ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateTransacaoDto } from './update-transacao.dto';

describe('UpdateTransacaoDto', () => {
  it('accepts an empty object (no fields required)', async () => {
    const dto = plainToInstance(UpdateTransacaoDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts a partial update of just valor', async () => {
    const dto = plainToInstance(UpdateTransacaoDto, { valor: 99.9 });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an invalid tipo when provided', async () => {
    const dto = plainToInstance(UpdateTransacaoDto, { tipo: 'INVALIDO' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'tipo')).toBe(true);
  });

  it('rejects a non-positive valor when provided', async () => {
    const dto = plainToInstance(UpdateTransacaoDto, { valor: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'valor')).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm run test -w backend -- create-transacao.dto update-transacao.dto`
Expected: FAIL — `Cannot find module './create-transacao.dto'` / `'./update-transacao.dto'`.

- [ ] **Step 3: Implementar os DTOs**

```ts
// backend/src/transacao/dto/create-transacao.dto.ts
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { TransacaoTipo } from '@prisma/client';

export class CreateTransacaoDto {
  @IsEnum(TransacaoTipo)
  tipo: TransacaoTipo;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor: number;

  @IsOptional()
  @IsUUID()
  categoriaId?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsDateString()
  data: string;
}
```

```ts
// backend/src/transacao/dto/update-transacao.dto.ts
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { TransacaoTipo } from '@prisma/client';

export class UpdateTransacaoDto {
  @IsOptional()
  @IsEnum(TransacaoTipo)
  tipo?: TransacaoTipo;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor?: number;

  @IsOptional()
  @IsUUID()
  categoriaId?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsDateString()
  data?: string;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm run test -w backend -- create-transacao.dto update-transacao.dto`
Expected: PASS (6 + 4 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/transacao/dto
git commit -m "feat: adiciona CreateTransacaoDto e UpdateTransacaoDto"
```

---

### Task 3: `CategoriaService` (auto-seed + listagem)

**Files:**
- Create: `backend/src/categoria/categoria.service.ts`
- Test: `backend/src/categoria/categoria.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (`../prisma/prisma.service`).
- Produces: `CategoriaResult { id: string; nome: string; cor: string | null; icone: string | null }`, `CategoriaService.findAll(): Promise<CategoriaResult[]>`.

- [ ] **Step 1: Escrever o teste**

```ts
// backend/src/categoria/categoria.service.spec.ts
import { CategoriaService } from './categoria.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CategoriaService', () => {
  const buildService = () => {
    const prisma = {
      categoria: {
        count: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 10 }),
        findMany: jest.fn(),
      },
    } as unknown as PrismaService;

    return { service: new CategoriaService(prisma), prisma };
  };

  describe('findAll', () => {
    it('seeds the default categorias when none exist', async () => {
      const { service, prisma } = buildService();
      (prisma.categoria.count as jest.Mock).mockResolvedValue(0);
      (prisma.categoria.findMany as jest.Mock).mockResolvedValue([]);

      await service.findAll();

      expect(prisma.categoria.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ nome: 'Salário', sistema: true }),
          expect.objectContaining({ nome: 'Outros', sistema: true }),
        ]),
      });
    });

    it('does not reseed when categorias already exist', async () => {
      const { service, prisma } = buildService();
      (prisma.categoria.count as jest.Mock).mockResolvedValue(10);
      (prisma.categoria.findMany as jest.Mock).mockResolvedValue([]);

      await service.findAll();

      expect(prisma.categoria.createMany).not.toHaveBeenCalled();
    });

    it('returns only system categorias, ordered by nome', async () => {
      const { service, prisma } = buildService();
      (prisma.categoria.count as jest.Mock).mockResolvedValue(10);
      (prisma.categoria.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'cat-1',
          nome: 'Alimentação',
          cor: '#F97316',
          icone: null,
          sistema: true,
        },
      ]);

      const result = await service.findAll();

      expect(prisma.categoria.findMany).toHaveBeenCalledWith({
        where: { sistema: true },
        orderBy: { nome: 'asc' },
      });
      expect(result).toEqual([
        { id: 'cat-1', nome: 'Alimentação', cor: '#F97316', icone: null },
      ]);
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test -w backend -- categoria.service`
Expected: FAIL — `Cannot find module './categoria.service'`.

- [ ] **Step 3: Implementar**

```ts
// backend/src/categoria/categoria.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CategoriaResult {
  id: string;
  nome: string;
  cor: string | null;
  icone: string | null;
}

const DEFAULT_CATEGORIAS = [
  { nome: 'Salário', cor: '#22C55E', icone: null, sistema: true },
  { nome: 'Renda Extra', cor: '#16A34A', icone: null, sistema: true },
  { nome: 'Alimentação', cor: '#F97316', icone: null, sistema: true },
  { nome: 'Transporte', cor: '#3B82F6', icone: null, sistema: true },
  { nome: 'Moradia', cor: '#8B5CF6', icone: null, sistema: true },
  { nome: 'Saúde', cor: '#EF4444', icone: null, sistema: true },
  { nome: 'Lazer', cor: '#EC4899', icone: null, sistema: true },
  { nome: 'Educação', cor: '#06B6D4', icone: null, sistema: true },
  { nome: 'Compras', cor: '#F59E0B', icone: null, sistema: true },
  { nome: 'Outros', cor: '#6B7280', icone: null, sistema: true },
];

@Injectable()
export class CategoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<CategoriaResult[]> {
    await this.ensureSeed();

    const categorias = await this.prisma.categoria.findMany({
      where: { sistema: true },
      orderBy: { nome: 'asc' },
    });

    return categorias.map((categoria) => ({
      id: categoria.id,
      nome: categoria.nome,
      cor: categoria.cor,
      icone: categoria.icone,
    }));
  }

  private async ensureSeed(): Promise<void> {
    const count = await this.prisma.categoria.count();
    if (count > 0) {
      return;
    }

    await this.prisma.categoria.createMany({ data: DEFAULT_CATEGORIAS });
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test -w backend -- categoria.service`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/categoria/categoria.service.ts backend/src/categoria/categoria.service.spec.ts
git commit -m "feat: adiciona CategoriaService com auto-seed de categorias do sistema"
```

---

### Task 4: `CategoriaController`, `CategoriaModule` e integração no `AppModule`

**Files:**
- Create: `backend/src/categoria/categoria.controller.ts`
- Test: `backend/src/categoria/categoria.controller.spec.ts`
- Create: `backend/src/categoria/categoria.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `CategoriaService` (Task 3), `JwtAuthGuard` (`../auth/guards/jwt-auth.guard`).
- Produces: rota HTTP `GET /categorias`.

- [ ] **Step 1: Escrever o teste do controller**

```ts
// backend/src/categoria/categoria.controller.spec.ts
import { CategoriaController } from './categoria.controller';
import { CategoriaService } from './categoria.service';

describe('CategoriaController', () => {
  it('delegates findAll to CategoriaService', async () => {
    const categorias = [
      { id: 'cat-1', nome: 'Alimentação', cor: '#F97316', icone: null },
    ];
    const categoriaService = {
      findAll: jest.fn().mockResolvedValue(categorias),
    } as unknown as CategoriaService;
    const controller = new CategoriaController(categoriaService);

    const result = await controller.findAll();

    expect(result).toEqual(categorias);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test -w backend -- categoria.controller`
Expected: FAIL — `Cannot find module './categoria.controller'`.

- [ ] **Step 3: Implementar o controller**

```ts
// backend/src/categoria/categoria.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CategoriaResult } from './categoria.service';
import { CategoriaService } from './categoria.service';

@Controller('categorias')
@UseGuards(JwtAuthGuard)
export class CategoriaController {
  constructor(private readonly categoriaService: CategoriaService) {}

  @Get()
  findAll(): Promise<CategoriaResult[]> {
    return this.categoriaService.findAll();
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test -w backend -- categoria.controller`
Expected: PASS (1 teste).

- [ ] **Step 5: Criar o módulo e integrar no `AppModule`**

```ts
// backend/src/categoria/categoria.module.ts
import { Module } from '@nestjs/common';
import { CategoriaController } from './categoria.controller';
import { CategoriaService } from './categoria.service';

@Module({
  controllers: [CategoriaController],
  providers: [CategoriaService],
})
export class CategoriaModule {}
```

```ts
// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { CategoriaModule } from './categoria/categoria.module';

@Module({
  imports: [PrismaModule, AuthModule, WorkspaceModule, CategoriaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 6: Rodar toda a suíte unitária do backend**

Run: `npm run test -w backend`
Expected: todos os testes passam.

- [ ] **Step 7: Commit**

```bash
git add backend/src/categoria/categoria.controller.ts backend/src/categoria/categoria.controller.spec.ts backend/src/categoria/categoria.module.ts backend/src/app.module.ts
git commit -m "feat: adiciona CategoriaController e integra CategoriaModule ao AppModule"
```

---

### Task 5: `TransacaoService.create()` + `TransacaoService.findByMonth()`

**Files:**
- Create: `backend/src/transacao/transacao.service.ts`
- Test: `backend/src/transacao/transacao.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (`../prisma/prisma.service`), `CreateTransacaoDto` (Task 2).
- Produces: `TransacaoResult { id: string; tipo: TransacaoTipo; valor: number; categoria: { id: string; nome: string; cor: string | null; icone: string | null } | null; descricao: string | null; data: Date; usuarioId: string }`, `TransacaoService.create(workspaceId: string, usuarioId: string, dto: CreateTransacaoDto): Promise<TransacaoResult>`, `TransacaoService.findByMonth(workspaceId: string, ano: number, mes: number): Promise<TransacaoResult[]>`.

- [ ] **Step 1: Escrever o teste**

```ts
// backend/src/transacao/transacao.service.spec.ts
import { BadRequestException } from '@nestjs/common';
import { TransacaoTipo } from '@prisma/client';
import { TransacaoService } from './transacao.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TransacaoService', () => {
  const workspaceId = 'ws-1';
  const usuarioId = 'user-1';

  const buildService = () => {
    const prisma = {
      categoria: { findUnique: jest.fn() },
      transacao: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as PrismaService;

    return { service: new TransacaoService(prisma), prisma };
  };

  describe('create', () => {
    it('creates a transacao without categoria', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.create as jest.Mock).mockResolvedValue({
        id: 'tx-1',
        tipo: TransacaoTipo.DESPESA,
        valor: '42.5',
        categoria: null,
        descricao: null,
        data: new Date('2026-07-15T00:00:00.000Z'),
        usuarioId,
      });

      const result = await service.create(workspaceId, usuarioId, {
        tipo: TransacaoTipo.DESPESA,
        valor: 42.5,
        data: '2026-07-15',
      });

      expect(prisma.transacao.create).toHaveBeenCalledWith({
        data: {
          workspaceId,
          usuarioId,
          tipo: TransacaoTipo.DESPESA,
          valor: 42.5,
          categoriaId: undefined,
          descricao: undefined,
          data: new Date('2026-07-15'),
        },
        include: { categoria: true },
      });
      expect(result.valor).toBe(42.5);
      expect(result.categoria).toBeNull();
    });

    it('rejects an unknown categoriaId', async () => {
      const { service, prisma } = buildService();
      (prisma.categoria.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create(workspaceId, usuarioId, {
          tipo: TransacaoTipo.DESPESA,
          valor: 10,
          categoriaId: 'cat-inexistente',
          data: '2026-07-15',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.transacao.create).not.toHaveBeenCalled();
    });
  });

  describe('findByMonth', () => {
    it('queries transacoes within the month range, ordered by data desc', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.findMany as jest.Mock).mockResolvedValue([]);

      await service.findByMonth(workspaceId, 2026, 7);

      expect(prisma.transacao.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId,
          data: {
            gte: new Date(Date.UTC(2026, 6, 1)),
            lt: new Date(Date.UTC(2026, 7, 1)),
          },
        },
        orderBy: { data: 'desc' },
        include: { categoria: true },
      });
    });

    it('handles december correctly (wraps to next year)', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.findMany as jest.Mock).mockResolvedValue([]);

      await service.findByMonth(workspaceId, 2026, 12);

      expect(prisma.transacao.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId,
          data: {
            gte: new Date(Date.UTC(2026, 11, 1)),
            lt: new Date(Date.UTC(2027, 0, 1)),
          },
        },
        orderBy: { data: 'desc' },
        include: { categoria: true },
      });
    });

    it('rejects an out-of-range mes', async () => {
      const { service } = buildService();

      await expect(
        service.findByMonth(workspaceId, 2026, 13),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test -w backend -- transacao.service`
Expected: FAIL — `Cannot find module './transacao.service'`.

- [ ] **Step 3: Implementar**

```ts
// backend/src/transacao/transacao.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { TransacaoTipo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransacaoDto } from './dto/create-transacao.dto';

export interface TransacaoResult {
  id: string;
  tipo: TransacaoTipo;
  valor: number;
  categoria: {
    id: string;
    nome: string;
    cor: string | null;
    icone: string | null;
  } | null;
  descricao: string | null;
  data: Date;
  usuarioId: string;
}

interface RawTransacao {
  id: string;
  tipo: TransacaoTipo;
  valor: unknown;
  categoria: {
    id: string;
    nome: string;
    cor: string | null;
    icone: string | null;
  } | null;
  descricao: string | null;
  data: Date;
  usuarioId: string;
}

@Injectable()
export class TransacaoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    workspaceId: string,
    usuarioId: string,
    dto: CreateTransacaoDto,
  ): Promise<TransacaoResult> {
    if (dto.categoriaId) {
      await this.assertCategoriaExists(dto.categoriaId);
    }

    const transacao = await this.prisma.transacao.create({
      data: {
        workspaceId,
        usuarioId,
        tipo: dto.tipo,
        valor: dto.valor,
        categoriaId: dto.categoriaId,
        descricao: dto.descricao,
        data: new Date(dto.data),
      },
      include: { categoria: true },
    });

    return this.toResult(transacao);
  }

  async findByMonth(
    workspaceId: string,
    ano: number,
    mes: number,
  ): Promise<TransacaoResult[]> {
    if (mes < 1 || mes > 12) {
      throw new BadRequestException('mes deve estar entre 1 e 12');
    }

    const inicio = new Date(Date.UTC(ano, mes - 1, 1));
    const fim = new Date(
      Date.UTC(mes === 12 ? ano + 1 : ano, mes === 12 ? 0 : mes, 1),
    );

    const transacoes = await this.prisma.transacao.findMany({
      where: { workspaceId, data: { gte: inicio, lt: fim } },
      orderBy: { data: 'desc' },
      include: { categoria: true },
    });

    return transacoes.map((transacao) => this.toResult(transacao));
  }

  private async assertCategoriaExists(categoriaId: string): Promise<void> {
    const categoria = await this.prisma.categoria.findUnique({
      where: { id: categoriaId },
    });
    if (!categoria) {
      throw new BadRequestException('categoria não encontrada');
    }
  }

  private toResult(transacao: RawTransacao): TransacaoResult {
    return {
      id: transacao.id,
      tipo: transacao.tipo,
      valor: Number(transacao.valor),
      categoria: transacao.categoria,
      descricao: transacao.descricao,
      data: transacao.data,
      usuarioId: transacao.usuarioId,
    };
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test -w backend -- transacao.service`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/transacao/transacao.service.ts backend/src/transacao/transacao.service.spec.ts
git commit -m "feat: adiciona TransacaoService.create e findByMonth"
```

---

### Task 6: `TransacaoService.update()` + `TransacaoService.delete()`

**Files:**
- Modify: `backend/src/transacao/transacao.service.ts` (adiciona `update`, `delete`, `findOwned`)
- Modify: `backend/src/transacao/transacao.service.spec.ts` (adiciona os `describe('update', ...)` e `describe('delete', ...)`)

**Interfaces:**
- Consumes: tudo da Task 5 (mesmo arquivo, mesma classe), `UpdateTransacaoDto` (Task 2).
- Produces: `TransacaoService.update(workspaceId: string, id: string, dto: UpdateTransacaoDto): Promise<TransacaoResult>`, `TransacaoService.delete(workspaceId: string, id: string): Promise<void>`.

- [ ] **Step 1: Adicionar os testes de `update`/`delete`**

Adicione ao topo de `backend/src/transacao/transacao.service.spec.ts` o import de `NotFoundException`:

```ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
```

Acrescente ao final do arquivo, dentro do mesmo `describe('TransacaoService', ...)`, depois do bloco `describe('findByMonth', ...)`:

```ts
  describe('update', () => {
    it('updates a transacao belonging to the workspace', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.findUnique as jest.Mock).mockResolvedValue({
        id: 'tx-1',
        workspaceId,
      });
      (prisma.transacao.update as jest.Mock).mockResolvedValue({
        id: 'tx-1',
        tipo: TransacaoTipo.RECEITA,
        valor: '100',
        categoria: null,
        descricao: 'atualizado',
        data: new Date('2026-07-16T00:00:00.000Z'),
        usuarioId,
      });

      const result = await service.update(workspaceId, 'tx-1', {
        descricao: 'atualizado',
      });

      expect(prisma.transacao.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: { descricao: 'atualizado' },
        include: { categoria: true },
      });
      expect(result.descricao).toBe('atualizado');
    });

    it('throws NotFoundException when the transacao belongs to another workspace', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.findUnique as jest.Mock).mockResolvedValue({
        id: 'tx-1',
        workspaceId: 'outro-workspace',
      });

      await expect(
        service.update(workspaceId, 'tx-1', { descricao: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.transacao.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the transacao does not exist', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update(workspaceId, 'tx-inexistente', { descricao: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an unknown categoriaId on update', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.findUnique as jest.Mock).mockResolvedValue({
        id: 'tx-1',
        workspaceId,
      });
      (prisma.categoria.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update(workspaceId, 'tx-1', { categoriaId: 'cat-inexistente' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.transacao.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes a transacao belonging to the workspace', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.findUnique as jest.Mock).mockResolvedValue({
        id: 'tx-1',
        workspaceId,
      });

      await service.delete(workspaceId, 'tx-1');

      expect(prisma.transacao.delete).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
      });
    });

    it('throws NotFoundException when the transacao belongs to another workspace', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.findUnique as jest.Mock).mockResolvedValue({
        id: 'tx-1',
        workspaceId: 'outro-workspace',
      });

      await expect(service.delete(workspaceId, 'tx-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.transacao.delete).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test -w backend -- transacao.service`
Expected: FAIL — `service.update is not a function` / `service.delete is not a function`.

- [ ] **Step 3: Implementar `update`, `delete` e `findOwned`**

Adicione em `backend/src/transacao/transacao.service.ts`, logo após `findByMonth` (antes do `private async assertCategoriaExists`):

```ts
  async update(
    workspaceId: string,
    id: string,
    dto: UpdateTransacaoDto,
  ): Promise<TransacaoResult> {
    await this.findOwned(workspaceId, id);

    if (dto.categoriaId) {
      await this.assertCategoriaExists(dto.categoriaId);
    }

    const transacao = await this.prisma.transacao.update({
      where: { id },
      data: {
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        ...(dto.valor !== undefined && { valor: dto.valor }),
        ...(dto.categoriaId !== undefined && { categoriaId: dto.categoriaId }),
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.data !== undefined && { data: new Date(dto.data) }),
      },
      include: { categoria: true },
    });

    return this.toResult(transacao);
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    await this.findOwned(workspaceId, id);
    await this.prisma.transacao.delete({ where: { id } });
  }

  private async findOwned(
    workspaceId: string,
    id: string,
  ): Promise<{ id: string; workspaceId: string }> {
    const transacao = await this.prisma.transacao.findUnique({
      where: { id },
    });
    if (!transacao || transacao.workspaceId !== workspaceId) {
      throw new NotFoundException('transação não encontrada');
    }
    return transacao;
  }
```

Adicione também os imports que faltam no topo do arquivo:

```ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateTransacaoDto } from './dto/update-transacao.dto';
```

(substitua a linha `import { BadRequestException, Injectable } from '@nestjs/common';` já existente por essa versão com `NotFoundException`, e adicione o import de `UpdateTransacaoDto` junto ao de `CreateTransacaoDto`.)

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test -w backend -- transacao.service`
Expected: PASS (10 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/transacao/transacao.service.ts backend/src/transacao/transacao.service.spec.ts
git commit -m "feat: adiciona TransacaoService.update e delete"
```

---

### Task 7: `TransacaoController`, `TransacaoModule` e integração no `AppModule`

**Files:**
- Create: `backend/src/transacao/transacao.controller.ts`
- Test: `backend/src/transacao/transacao.controller.spec.ts`
- Create: `backend/src/transacao/transacao.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `TransacaoService` (Tasks 5/6), `JwtAuthGuard`, `WorkspaceGuard` (Task 1), `CurrentUser`/`AuthenticatedUser`, `CurrentWorkspace`/`WorkspaceResult` (Task 1), `CreateTransacaoDto`/`UpdateTransacaoDto` (Task 2).
- Produces: rotas HTTP `POST /transacoes`, `GET /transacoes`, `PATCH /transacoes/:id`, `DELETE /transacoes/:id`.

- [ ] **Step 1: Escrever o teste do controller**

```ts
// backend/src/transacao/transacao.controller.spec.ts
import { TransacaoTipo } from '@prisma/client';
import { TransacaoController } from './transacao.controller';
import { TransacaoService } from './transacao.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { WorkspaceResult } from '../workspace/workspace.service';

describe('TransacaoController', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    nome: 'Marcos',
    email: 'marcos@example.com',
    cpf: '11144477735',
    criadoEm: new Date(),
  };
  const workspace: WorkspaceResult = {
    id: 'ws-1',
    nome: 'Financeiro de Marcos',
    plano: { tipo: 'INDIVIDUAL' },
  };

  const buildController = () => {
    const transacaoService = {
      create: jest.fn(),
      findByMonth: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as TransacaoService;

    return {
      controller: new TransacaoController(transacaoService),
      transacaoService,
    };
  };

  it('delegates create with the current user and workspace ids', async () => {
    const { controller, transacaoService } = buildController();
    const dto = { tipo: TransacaoTipo.DESPESA, valor: 10, data: '2026-07-15' };
    (transacaoService.create as jest.Mock).mockResolvedValue({ id: 'tx-1' });

    await controller.create(dto, user, workspace);

    expect(transacaoService.create).toHaveBeenCalledWith(
      workspace.id,
      user.id,
      dto,
    );
  });

  it('delegates findByMonth with the workspace id', async () => {
    const { controller, transacaoService } = buildController();
    (transacaoService.findByMonth as jest.Mock).mockResolvedValue([]);

    await controller.findByMonth(2026, 7, workspace);

    expect(transacaoService.findByMonth).toHaveBeenCalledWith(
      workspace.id,
      2026,
      7,
    );
  });

  it('delegates update with the workspace id', async () => {
    const { controller, transacaoService } = buildController();
    (transacaoService.update as jest.Mock).mockResolvedValue({ id: 'tx-1' });

    await controller.update('tx-1', { descricao: 'novo' }, workspace);

    expect(transacaoService.update).toHaveBeenCalledWith(
      workspace.id,
      'tx-1',
      { descricao: 'novo' },
    );
  });

  it('delegates delete with the workspace id', async () => {
    const { controller, transacaoService } = buildController();
    (transacaoService.delete as jest.Mock).mockResolvedValue(undefined);

    await controller.delete('tx-1', workspace);

    expect(transacaoService.delete).toHaveBeenCalledWith(workspace.id, 'tx-1');
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test -w backend -- transacao.controller`
Expected: FAIL — `Cannot find module './transacao.controller'`.

- [ ] **Step 3: Implementar o controller**

```ts
// backend/src/transacao/transacao.controller.ts
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
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test -w backend -- transacao.controller`
Expected: PASS (4 testes).

- [ ] **Step 5: Criar o módulo e integrar no `AppModule`**

```ts
// backend/src/transacao/transacao.module.ts
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
```

```ts
// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { CategoriaModule } from './categoria/categoria.module';
import { TransacaoModule } from './transacao/transacao.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WorkspaceModule,
    CategoriaModule,
    TransacaoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 6: Rodar toda a suíte unitária do backend**

Run: `npm run test -w backend`
Expected: todos os testes passam.

- [ ] **Step 7: Commit**

```bash
git add backend/src/transacao/transacao.controller.ts backend/src/transacao/transacao.controller.spec.ts backend/src/transacao/transacao.module.ts backend/src/app.module.ts
git commit -m "feat: adiciona TransacaoController e integra TransacaoModule ao AppModule"
```

---

### Task 8: Teste e2e do fluxo de transações

**Files:**
- Create: `backend/test/transacao.e2e-spec.ts`

**Interfaces:**
- Consumes: `AppModule`, `PrismaService`, `randomValidCpf` (`./fixtures/cpf`, já existente).

- [ ] **Step 1: Escrever o teste e2e**

```ts
// backend/test/transacao.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { randomValidCpf } from './fixtures/cpf';

describe('Transacao (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];
  const createdWorkspaceIds: string[] = [];
  const createdTransacaoIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    if (createdTransacaoIds.length > 0) {
      await prisma.transacao.deleteMany({
        where: { id: { in: createdTransacaoIds } },
      });
    }
    if (createdUserIds.length > 0) {
      await prisma.usuario.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
    if (createdWorkspaceIds.length > 0) {
      await prisma.workspace.deleteMany({
        where: { id: { in: createdWorkspaceIds } },
      });
    }
    await app.close();
  });

  async function registerComWorkspace(): Promise<string> {
    const unique = `${Date.now()}-${Math.random()}`;
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nome: 'Transacao Teste',
        email: `transacao-e2e-${unique}@example.com`,
        cpf: randomValidCpf(),
        senha: 'password123',
      })
      .expect(201);

    createdUserIds.push(registerResponse.body.usuario.id);
    const accessToken = registerResponse.body.accessToken as string;

    const workspaceResponse = await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tipo: 'INDIVIDUAL' })
      .expect(201);

    createdWorkspaceIds.push(workspaceResponse.body.id);
    return accessToken;
  }

  it('lists the seeded system categorias', async () => {
    const accessToken = await registerComWorkspace();

    const response = await request(app.getHttpServer())
      .get('/categorias')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.length).toBeGreaterThanOrEqual(10);
    expect(
      response.body.some((c: { nome: string }) => c.nome === 'Outros'),
    ).toBe(true);
  });

  it('creates, lists by month, updates and deletes a transacao', async () => {
    const accessToken = await registerComWorkspace();

    const createResponse = await request(app.getHttpServer())
      .post('/transacoes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        tipo: 'DESPESA',
        valor: 50.25,
        data: '2026-07-10',
        descricao: 'mercado',
      })
      .expect(201);

    createdTransacaoIds.push(createResponse.body.id);
    expect(createResponse.body.valor).toBe(50.25);

    const listResponse = await request(app.getHttpServer())
      .get('/transacoes?ano=2026&mes=7')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].id).toBe(createResponse.body.id);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/transacoes/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ descricao: 'mercado do mês' })
      .expect(200);

    expect(updateResponse.body.descricao).toBe('mercado do mês');

    await request(app.getHttpServer())
      .delete(`/transacoes/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    const listAfterDelete = await request(app.getHttpServer())
      .get('/transacoes?ano=2026&mes=7')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(listAfterDelete.body).toHaveLength(0);
    createdTransacaoIds.pop();
  });

  it('rejects editing or deleting a transacao from another workspace', async () => {
    const tokenA = await registerComWorkspace();
    const tokenB = await registerComWorkspace();

    const createResponse = await request(app.getHttpServer())
      .post('/transacoes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ tipo: 'RECEITA', valor: 1000, data: '2026-07-01' })
      .expect(201);

    createdTransacaoIds.push(createResponse.body.id);

    await request(app.getHttpServer())
      .patch(`/transacoes/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ descricao: 'tentativa indevida' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/transacoes/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('rejects an unauthenticated request', async () => {
    await request(app.getHttpServer())
      .get('/transacoes?ano=2026&mes=7')
      .expect(401);
  });
});
```

- [ ] **Step 2: Rodar o teste e2e**

Run: `npm run test:e2e -w backend`
Expected: PASS (4 testes em `Transacao (e2e)`, mais os suites já existentes de `AppController`, `Auth` e `Workspace`).

- [ ] **Step 3: Commit**

```bash
git add backend/test/transacao.e2e-spec.ts
git commit -m "test: adiciona teste e2e do fluxo de transações"
```

---

### Task 9: Frontend — `apiPatch`/`apiDelete` em `api.ts`

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Produces: `apiPatch<T>(path: string, body?: unknown): Promise<T>`, `apiDelete<T>(path: string): Promise<T>`.

**Por quê:** o cliente HTTP hoje só tem `apiGet`/`apiPost`. Editar e excluir transações precisam de `PATCH`/`DELETE`.

- [ ] **Step 1: Adicionar as duas funções**

Em `frontend/src/lib/api.ts`, adicione ao final do arquivo, depois de `apiPost`:

```ts
export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}
```

- [ ] **Step 2: Verificar que o frontend compila**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: sem erros de tipo.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: adiciona apiPatch e apiDelete ao cliente de API"
```

---

### Task 10: Frontend — `transacoes-api.ts` + `useTransacoes`

**Files:**
- Create: `frontend/src/lib/transacoes-api.ts`
- Create: `frontend/src/hooks/use-transacoes.ts`

**Interfaces:**
- Consumes: `apiGet`/`apiPost`/`apiPatch`/`apiDelete` (`@/lib/api`, Task 9).
- Produces: tipos `TransacaoTipo`, `Categoria`, `Transacao`, `TransacaoInput`; funções `createTransacao`, `updateTransacao`, `deleteTransacao`; hook `useTransacoes(ano, mes): { transacoes, isLoading, error, refetch }`.

**Por quê duas peças separadas:** a tela de lançamento/edição (Task 11) só precisa das funções de mutação (não precisa saber em qual mês está a lista). A tela de lista (Task 12) precisa do hook, escopado por mês. Separar evita que a tela de formulário instancie um hook de listagem que ela não usa.

- [ ] **Step 1: Implementar `transacoes-api.ts`**

```ts
// frontend/src/lib/transacoes-api.ts
import { apiDelete, apiPatch, apiPost } from '@/lib/api';

export type TransacaoTipo = 'RECEITA' | 'DESPESA';

export interface Categoria {
  id: string;
  nome: string;
  cor: string | null;
  icone: string | null;
}

export interface Transacao {
  id: string;
  tipo: TransacaoTipo;
  valor: number;
  categoria: Categoria | null;
  descricao: string | null;
  data: string;
  usuarioId: string;
}

export interface TransacaoInput {
  tipo: TransacaoTipo;
  valor: number;
  categoriaId?: string;
  descricao?: string;
  data: string;
}

export function createTransacao(input: TransacaoInput): Promise<Transacao> {
  return apiPost<Transacao>('/transacoes', input);
}

export function updateTransacao(
  id: string,
  input: Partial<TransacaoInput>,
): Promise<Transacao> {
  return apiPatch<Transacao>(`/transacoes/${id}`, input);
}

export function deleteTransacao(id: string): Promise<void> {
  return apiDelete<void>(`/transacoes/${id}`);
}
```

- [ ] **Step 2: Implementar `useTransacoes`**

```ts
// frontend/src/hooks/use-transacoes.ts
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { apiGet } from '@/lib/api';
import type { Transacao } from '@/lib/transacoes-api';

interface UseTransacoesResult {
  transacoes: Transacao[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useTransacoes(ano: number, mes: number): UseTransacoesResult {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Guarda a request mais recente: se o mês mudar de novo (ou a tela ganhar
  // foco de novo) antes desta resolver, uma resposta atrasada não deve
  // sobrescrever o estado com dados de um mês que não é mais o exibido.
  const requestIdRef = useRef(0);

  const fetchTransacoes = useCallback(async (): Promise<void> => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiGet<Transacao[]>(
        `/transacoes?ano=${ano}&mes=${mes}`,
      );
      if (requestIdRef.current === requestId) {
        setTransacoes(result);
      }
    } catch (err) {
      if (requestIdRef.current === requestId) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [ano, mes]);

  useFocusEffect(
    useCallback(() => {
      fetchTransacoes();
    }, [fetchTransacoes]),
  );

  return { transacoes, isLoading, error, refetch: fetchTransacoes };
}
```

`useFocusEffect` recarrega a lista tanto na primeira vez que a tela ganha
foco quanto ao voltar do formulário de lançamento/edição (Task 11) — sem
precisar de um mecanismo de invalidação manual entre as duas telas.

- [ ] **Step 3: Verificar que o frontend compila**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: sem erros de tipo.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/transacoes-api.ts frontend/src/hooks/use-transacoes.ts
git commit -m "feat: adiciona transacoes-api e useTransacoes"
```

---

### Task 11: Frontend — reestrutura navegação do `(app)` + tela de lançamento/edição

**Files:**
- Create: `frontend/src/app/(app)/(tabs)/_layout.tsx`
- Move: `frontend/src/app/(app)/index.tsx` → `frontend/src/app/(app)/(tabs)/index.tsx` (conteúdo inalterado nesta task)
- Move: `frontend/src/app/(app)/explore.tsx` → `frontend/src/app/(app)/(tabs)/explore.tsx` (conteúdo inalterado)
- Modify: `frontend/src/app/(app)/_layout.tsx`
- Create: `frontend/src/app/(app)/nova-transacao.tsx`

**Interfaces:**
- Consumes: `createTransacao`/`updateTransacao` (`@/lib/transacoes-api`, Task 10), `apiGet` (`@/lib/api`).
- Produces: rota `/nova-transacao` (Stack, apresentação modal), navegável tanto para criar (sem params) quanto para editar (com `id` + campos atuais via params).

**Por quê a reestrutura:** hoje `(app)/_layout.tsx` renderiza `<AppTabs />`
(um `NativeTabs`) diretamente — sem um `Stack` por baixo, não há como
empurrar uma tela que não é aba (o formulário) por cima da tab bar. O
padrão recomendado pelo próprio Expo Router é aninhar as tabs dentro de um
`Stack` externo, com as telas que não são abas como `Stack.Screen` irmãs
(https://docs.expo.dev/router/advanced/native-tabs/, seção sobre navegação
aninhada). Isso move `index.tsx`/`explore.tsx` um nível mais fundo (para
dentro de um grupo `(tabs)`), sem mudar o conteúdo deles nesta task.

- [ ] **Step 1: Mover as telas das abas para `(tabs)/`**

```bash
mkdir -p frontend/src/app/\(app\)/\(tabs\)
git mv "frontend/src/app/(app)/index.tsx" "frontend/src/app/(app)/(tabs)/index.tsx"
git mv "frontend/src/app/(app)/explore.tsx" "frontend/src/app/(app)/(tabs)/explore.tsx"
```

- [ ] **Step 2: Criar o layout do grupo `(tabs)`**

```tsx
// frontend/src/app/(app)/(tabs)/_layout.tsx
import AppTabs from '@/components/app-tabs';

export default function TabsLayout() {
  return <AppTabs />;
}
```

- [ ] **Step 3: Reescrever o layout do `(app)` como `Stack` (tabs + modal)**

```tsx
// frontend/src/app/(app)/_layout.tsx
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function AppLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="nova-transacao"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Transação',
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
```

(O `ThemeProvider` estava antes dentro do layout das tabs — agora fica no
nível do `Stack` externo, pra também cobrir o header nativo da tela modal.)

- [ ] **Step 4: Implementar a tela de lançamento/edição**

```tsx
// frontend/src/app/(app)/nova-transacao.tsx
import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { apiGet } from '@/lib/api';
import {
  createTransacao,
  updateTransacao,
  type Categoria,
  type TransacaoTipo,
} from '@/lib/transacoes-api';
import { Spacing } from '@/constants/theme';

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NovaTransacaoScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    tipo?: string;
    valor?: string;
    categoriaId?: string;
    descricao?: string;
    data?: string;
  }>();
  const isEditing = typeof params.id === 'string';

  const [tipo, setTipo] = useState<TransacaoTipo>(
    params.tipo === 'RECEITA' ? 'RECEITA' : 'DESPESA',
  );
  const [valor, setValor] = useState(params.valor ?? '');
  const [categoriaId, setCategoriaId] = useState<string | undefined>(
    params.categoriaId,
  );
  const [descricao, setDescricao] = useState(params.descricao ?? '');
  const [data, setData] = useState(params.data ?? todayISODate());
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    apiGet<Categoria[]>('/categorias')
      .then((result) => {
        if (active) {
          setCategorias(result);
        }
      })
      .catch(() => {
        // lista de categorias é auxiliar (seleção opcional); uma falha
        // aqui não deve travar o formulário de lançamento.
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async () => {
    setError(null);
    const valorNumerico = Number(valor.replace(',', '.'));
    if (!valor || Number.isNaN(valorNumerico) || valorNumerico <= 0) {
      setError('informe um valor válido');
      return;
    }

    setIsSubmitting(true);
    try {
      const input = {
        tipo,
        valor: valorNumerico,
        categoriaId,
        descricao: descricao || undefined,
        data,
      };
      if (isEditing && typeof params.id === 'string') {
        await updateTransacao(params.id, input);
      } else {
        await createTransacao(input);
      }
      router.back();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'erro ao salvar transação',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">
          {isEditing ? 'Editar transação' : 'Nova transação'}
        </ThemedText>

        <ThemedView style={styles.toggleRow}>
          <Pressable
            onPress={() => setTipo('RECEITA')}
            style={[
              styles.toggleOption,
              tipo === 'RECEITA' && styles.toggleOptionActive,
            ]}>
            <ThemedText type="smallBold">Receita</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setTipo('DESPESA')}
            style={[
              styles.toggleOption,
              tipo === 'DESPESA' && styles.toggleOptionActive,
            ]}>
            <ThemedText type="smallBold">Despesa</ThemedText>
          </Pressable>
        </ThemedView>

        <TextInput
          placeholder="valor"
          keyboardType="decimal-pad"
          value={valor}
          onChangeText={setValor}
          style={styles.input}
        />

        <TextInput
          placeholder="data (AAAA-MM-DD)"
          value={data}
          onChangeText={setData}
          style={styles.input}
        />

        <TextInput
          placeholder="descrição (opcional)"
          value={descricao}
          onChangeText={setDescricao}
          style={styles.input}
        />

        <ThemedView style={styles.categoriaRow}>
          {categorias.map((categoria) => (
            <Pressable
              key={categoria.id}
              onPress={() =>
                setCategoriaId(
                  categoriaId === categoria.id ? undefined : categoria.id,
                )
              }
              style={[
                styles.categoriaChip,
                categoriaId === categoria.id && styles.categoriaChipActive,
              ]}>
              <ThemedText type="small">{categoria.nome}</ThemedText>
            </Pressable>
          ))}
        </ThemedView>

        {error && <ThemedText themeColor="textSecondary">{error}</ThemedText>}

        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={styles.button}>
          <ThemedText type="smallBold">
            {isSubmitting ? 'salvando...' : 'salvar'}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  input: {
    borderWidth: 1,
    borderColor: '#8888',
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  toggleOption: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#8888',
    borderRadius: Spacing.two,
  },
  toggleOptionActive: {
    backgroundColor: '#3c87f7',
  },
  categoriaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  categoriaChip: {
    borderWidth: 1,
    borderColor: '#8888',
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  categoriaChipActive: {
    backgroundColor: '#3c87f7',
  },
  button: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
  },
});
```

- [ ] **Step 5: Verificar que o frontend compila**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: sem erros de tipo.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/\(app\)
git commit -m "feat: reestrutura navegação do (app) em (tabs) e adiciona tela de lançamento/edição"
```

---

### Task 12: Frontend — lista de transações do mês na Home

**Files:**
- Modify: `frontend/src/constants/theme.ts` (adiciona cores `income`/`expense`)
- Modify: `frontend/src/app/(app)/(tabs)/index.tsx` (substitui o boilerplate do Expo)

**Interfaces:**
- Consumes: `useTransacoes` (`@/hooks/use-transacoes`, Task 10), `deleteTransacao` (`@/lib/transacoes-api`, Task 10).

- [ ] **Step 1: Adicionar as cores de receita/despesa ao tema**

Em `frontend/src/constants/theme.ts`, adicione `income`/`expense` aos dois
temas:

```ts
export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    income: '#16A34A',
    expense: '#DC2626',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    income: '#4ADE80',
    expense: '#F87171',
  },
} as const;
```

(Só essas duas linhas mudam em cada bloco — o resto do arquivo continua
igual.)

- [ ] **Step 2: Reescrever a tela Home**

```tsx
// frontend/src/app/(app)/(tabs)/index.tsx
import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTransacoes } from '@/hooks/use-transacoes';
import { deleteTransacao, type Transacao } from '@/lib/transacoes-api';
import { BottomTabInset, Spacing } from '@/constants/theme';

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function formatValor(valor: number, tipo: Transacao['tipo']): string {
  const sinal = tipo === 'DESPESA' ? '-' : '+';
  return `${sinal} R$ ${valor.toFixed(2).replace('.', ',')}`;
}

export default function HomeScreen() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const { transacoes, isLoading, error, refetch } = useTransacoes(ano, mes);

  const irParaMesAnterior = () => {
    if (mes === 1) {
      setAno(ano - 1);
      setMes(12);
    } else {
      setMes(mes - 1);
    }
  };

  const irParaProximoMes = () => {
    if (mes === 12) {
      setAno(ano + 1);
      setMes(1);
    } else {
      setMes(mes + 1);
    }
  };

  const confirmarExclusao = (id: string) => {
    Alert.alert(
      'Excluir transação',
      'Tem certeza que deseja excluir esta transação?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteTransacao(id);
            await refetch();
          },
        },
      ],
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <Pressable onPress={irParaMesAnterior}>
            <ThemedText type="smallBold">◀</ThemedText>
          </Pressable>
          <ThemedText type="subtitle">
            {MESES[mes - 1]} {ano}
          </ThemedText>
          <Pressable onPress={irParaProximoMes}>
            <ThemedText type="smallBold">▶</ThemedText>
          </Pressable>
        </ThemedView>

        {isLoading && <ThemedText type="small">carregando...</ThemedText>}
        {error && (
          <ThemedText themeColor="textSecondary">
            erro ao carregar transações: {error.message}
          </ThemedText>
        )}

        <FlatList
          data={transacoes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            !isLoading ? (
              <ThemedText type="small" themeColor="textSecondary">
                nenhuma transação em {MESES[mes - 1].toLowerCase()}
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/nova-transacao',
                  params: {
                    id: item.id,
                    tipo: item.tipo,
                    valor: String(item.valor),
                    categoriaId: item.categoria?.id,
                    descricao: item.descricao ?? undefined,
                    data: item.data.slice(0, 10),
                  },
                })
              }
              onLongPress={() => confirmarExclusao(item.id)}
              style={styles.item}>
              <ThemedView style={styles.itemInfo}>
                <ThemedText type="smallBold">
                  {item.categoria?.nome ?? 'Sem categoria'}
                </ThemedText>
                {item.descricao && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.descricao}
                  </ThemedText>
                )}
              </ThemedView>
              <ThemedText
                type="smallBold"
                themeColor={item.tipo === 'DESPESA' ? 'expense' : 'income'}>
                {formatValor(item.valor, item.tipo)}
              </ThemedText>
            </Pressable>
          )}
        />

        <Pressable
          onPress={() => router.push('/nova-transacao')}
          style={styles.fab}>
          <ThemedText type="title" themeColor="background">
            +
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  list: {
    gap: Spacing.two,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#8888',
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  itemInfo: {
    gap: Spacing.half,
  },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: Spacing.four + BottomTabInset,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3c87f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 3: Verificar que o frontend compila**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: sem erros de tipo.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/constants/theme.ts "frontend/src/app/(app)/(tabs)/index.tsx"
git commit -m "feat: adiciona lista de transações do mês com navegação na Home"
```

---

### Task 13: Verificação manual de ponta a ponta

**Files:** nenhum (só validação)

- [ ] **Step 1: Subir o backend e o app**

```bash
npm run db:up
npm run dev:backend
```

Em outro terminal: `npx expo start --web` dentro de `frontend/`.

- [ ] **Step 2: Testar o fluxo completo de uma transação**

Logue numa conta que já tem workspace (ou crie uma nova e escolha um
plano no onboarding). Na Home, confirme que aparece o mês atual sem
transações. Toque no "+", preencha uma despesa (ex: R$ 50, categoria
"Alimentação", descrição "mercado") e salve. Confirme que volta pra Home
e a transação aparece na lista, com o valor em vermelho.

- [ ] **Step 3: Testar edição**

Toque na transação criada, altere a descrição, salve. Confirme que a
lista reflete a mudança ao voltar.

- [ ] **Step 4: Testar exclusão**

Toque e segure (long-press) na transação, confirme a exclusão no alerta
nativo. Confirme que ela some da lista.

- [ ] **Step 5: Testar navegação entre meses**

Lance uma transação com data do mês anterior (ex: dia 1 do mês passado).
Volte pra Home, use a seta "◀" pra ir pro mês anterior e confirme que ela
aparece lá (e não no mês atual).

- [ ] **Step 6: Testar isolamento entre workspaces (via curl)**

Registre uma segunda conta com seu próprio workspace, pegue o
`accessToken` dela e tente editar/excluir uma transação do primeiro
workspace:

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X PATCH http://localhost:3000/transacoes/<ID_DA_TRANSACAO_DO_WORKSPACE_A> \
  -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN_DO_WORKSPACE_B>" \
  -d '{"descricao":"tentativa indevida"}'
```

Confirme `HTTP 404`.

Nenhum commit nesta task — é validação manual do que já foi commitado nas
tasks anteriores. Se algum passo falhar, volte pra task correspondente,
corrija e re-commit.
