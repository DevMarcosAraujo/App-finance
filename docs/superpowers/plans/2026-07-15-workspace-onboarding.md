# Onboarding de Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Depois de autenticado, se o usuário não pertence a nenhum `Workspace`, ele passa por uma tela de onboarding (escolher Individual ou Família/Casal) que cria o primeiro workspace antes de liberar o resto do app.

**Architecture:** Novo `WorkspaceModule` no NestJS (`POST /workspaces`, `GET /workspaces/me`, ambos guardados por `JwtAuthGuard` já existente do `AuthModule`) com auto-seed de `Plano` na primeira criação. No Expo, novo `WorkspaceContext` aninhado dentro do `AuthProvider`, e um terceiro grupo de rota `(onboarding)` no `expo-router`, com gating de três estados no layout raiz (`(auth)` / `(onboarding)` / `(app)`).

**Tech Stack:** NestJS 11, Prisma 6 (nenhuma migration nova — `Workspace`/`WorkspaceMembro`/`Plano` já existem no schema), Jest/Supertest, Expo/expo-router (mesmo padrão do módulo de auth já implementado).

## Global Constraints

- Nenhuma migration de schema nesta etapa — os models `Workspace`, `WorkspaceMembro`, `Plano` já existem em `backend/prisma/schema.prisma`.
- Auto-seed: se a tabela `Plano` estiver vazia, cria os dois planos padrão (`INDIVIDUAL` e `FAMILIA`) numa tacada só, com `precoBase: 0` (sem cobrança real nesta fase).
- Nome do workspace é sempre auto-gerado (`"Financeiro de {primeiro nome}"`) — sem campo de texto na tela.
- Sem preço exibido na tela de onboarding.
- Convite de membro por email, múltiplas contas bancárias por membro, limite de membros fixo/escalável, cobrança real e renomear workspace ficam **fora de escopo** deste plano.
- Onboarding é obrigatório: usuário autenticado sem workspace só vê o grupo `(onboarding)`, nunca o `(app)`.
- Reaproveitar `JwtAuthGuard` (`backend/src/auth/guards/jwt-auth.guard.ts`) e `CurrentUser`/`AuthenticatedUser` (`backend/src/auth/decorators/current-user.decorator.ts` / `backend/src/auth/strategies/jwt.strategy.ts`) diretamente — sem duplicar guard/strategy, sem precisar importar `AuthModule` inteiro no `WorkspaceModule` (esses arquivos não têm dependências de DI próprias).
- Todos os comandos `npm` assumem execução a partir da raiz do repositório (`/home/marcosebia/Documentos/Dev/Sistema-finance`), usando `npm run <script> -w backend` (ou `-w frontend`).
- Ambiente local: Postgres do projeto roda na porta **5433** (não 5432 — porta ocupada por um serviço nativo neste host). `backend/.env` já aponta pra 5433.

---

### Task 1: `CreateWorkspaceDto`

**Files:**
- Create: `backend/src/workspace/dto/create-workspace.dto.ts`
- Test: `backend/src/workspace/dto/create-workspace.dto.spec.ts`

**Interfaces:**
- Produces: `CreateWorkspaceDto { tipo: PlanoTipo }`.

- [ ] **Step 1: Escrever o teste**

```ts
// backend/src/workspace/dto/create-workspace.dto.spec.ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateWorkspaceDto } from './create-workspace.dto';

describe('CreateWorkspaceDto', () => {
  it('accepts INDIVIDUAL', async () => {
    const dto = plainToInstance(CreateWorkspaceDto, { tipo: 'INDIVIDUAL' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts FAMILIA', async () => {
    const dto = plainToInstance(CreateWorkspaceDto, { tipo: 'FAMILIA' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an invalid tipo', async () => {
    const dto = plainToInstance(CreateWorkspaceDto, { tipo: 'ENTERPRISE' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'tipo')).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test -w backend -- create-workspace.dto`
Expected: FAIL — `Cannot find module './create-workspace.dto'`.

- [ ] **Step 3: Implementar**

```ts
// backend/src/workspace/dto/create-workspace.dto.ts
import { IsEnum } from 'class-validator';
import { PlanoTipo } from '@prisma/client';

export class CreateWorkspaceDto {
  @IsEnum(PlanoTipo)
  tipo: PlanoTipo;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test -w backend -- create-workspace.dto`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/workspace/dto
git commit -m "feat: adiciona CreateWorkspaceDto"
```

---

### Task 2: `WorkspaceService.create()` (+ auto-seed de `Plano`)

**Files:**
- Create: `backend/src/workspace/workspace.service.ts`
- Test: `backend/src/workspace/workspace.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (`../prisma/prisma.service`).
- Produces: `WorkspaceResult { id: string; nome: string; plano: { tipo: PlanoTipo } }`, `WorkspaceService.create(usuarioId: string, usuarioNome: string, tipo: PlanoTipo): Promise<WorkspaceResult>`.

- [ ] **Step 1: Escrever o teste**

```ts
// backend/src/workspace/workspace.service.spec.ts
import { ConflictException } from '@nestjs/common';
import { PlanoTipo, WorkspaceRole } from '@prisma/client';
import { WorkspaceService } from './workspace.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WorkspaceService', () => {
  const usuarioId = 'user-1';
  const usuarioNome = 'Marcos Teste';

  const buildService = () => {
    const prisma = {
      workspaceMembro: {
        findFirst: jest.fn(),
      },
      plano: {
        count: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        findFirst: jest.fn(),
      },
      workspace: {
        create: jest.fn(),
      },
    } as unknown as PrismaService;

    return { service: new WorkspaceService(prisma), prisma };
  };

  describe('create', () => {
    it('throws ConflictException when the user already has a workspace', async () => {
      const { service, prisma } = buildService();
      (prisma.workspaceMembro.findFirst as jest.Mock).mockResolvedValue({
        id: 'membro-1',
      });

      await expect(
        service.create(usuarioId, usuarioNome, PlanoTipo.INDIVIDUAL),
      ).rejects.toThrow(ConflictException);
      expect(prisma.workspace.create).not.toHaveBeenCalled();
    });

    it('seeds the default planos when none exist', async () => {
      const { service, prisma } = buildService();
      (prisma.workspaceMembro.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.plano.count as jest.Mock).mockResolvedValue(0);
      (prisma.plano.findFirst as jest.Mock).mockResolvedValue({
        id: 'plano-1',
        tipo: PlanoTipo.INDIVIDUAL,
      });
      (prisma.workspace.create as jest.Mock).mockResolvedValue({
        id: 'ws-1',
        nome: 'Financeiro de Marcos',
      });

      await service.create(usuarioId, usuarioNome, PlanoTipo.INDIVIDUAL);

      expect(prisma.plano.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ tipo: PlanoTipo.INDIVIDUAL }),
          expect.objectContaining({ tipo: PlanoTipo.FAMILIA }),
        ]),
      });
    });

    it('does not reseed planos when they already exist', async () => {
      const { service, prisma } = buildService();
      (prisma.workspaceMembro.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.plano.count as jest.Mock).mockResolvedValue(2);
      (prisma.plano.findFirst as jest.Mock).mockResolvedValue({
        id: 'plano-1',
        tipo: PlanoTipo.INDIVIDUAL,
      });
      (prisma.workspace.create as jest.Mock).mockResolvedValue({
        id: 'ws-1',
        nome: 'Financeiro de Marcos',
      });

      await service.create(usuarioId, usuarioNome, PlanoTipo.INDIVIDUAL);

      expect(prisma.plano.createMany).not.toHaveBeenCalled();
    });

    it('creates the workspace with an auto-generated name and the creator as DONO', async () => {
      const { service, prisma } = buildService();
      (prisma.workspaceMembro.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.plano.count as jest.Mock).mockResolvedValue(2);
      (prisma.plano.findFirst as jest.Mock).mockResolvedValue({
        id: 'plano-1',
        tipo: PlanoTipo.INDIVIDUAL,
      });
      (prisma.workspace.create as jest.Mock).mockResolvedValue({
        id: 'ws-1',
        nome: 'Financeiro de Marcos',
      });

      const result = await service.create(
        usuarioId,
        usuarioNome,
        PlanoTipo.INDIVIDUAL,
      );

      expect(prisma.workspace.create).toHaveBeenCalledWith({
        data: {
          nome: 'Financeiro de Marcos',
          planoId: 'plano-1',
          membros: {
            create: { usuarioId, role: WorkspaceRole.DONO },
          },
        },
      });
      expect(result).toEqual({
        id: 'ws-1',
        nome: 'Financeiro de Marcos',
        plano: { tipo: PlanoTipo.INDIVIDUAL },
      });
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test -w backend -- workspace.service`
Expected: FAIL — `Cannot find module './workspace.service'`.

- [ ] **Step 3: Implementar**

```ts
// backend/src/workspace/workspace.service.ts
import { ConflictException, Injectable } from '@nestjs/common';
import { PlanoTipo, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface WorkspaceResult {
  id: string;
  nome: string;
  plano: {
    tipo: PlanoTipo;
  };
}

const DEFAULT_PLANOS = [
  {
    tipo: PlanoTipo.INDIVIDUAL,
    nome: 'Individual',
    precoBase: 0,
    precoPorMembro: null,
    limiteMembros: 1,
  },
  {
    tipo: PlanoTipo.FAMILIA,
    nome: 'Família',
    precoBase: 0,
    precoPorMembro: 0,
    limiteMembros: null,
  },
];

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    usuarioId: string,
    usuarioNome: string,
    tipo: PlanoTipo,
  ): Promise<WorkspaceResult> {
    const existingMembership = await this.prisma.workspaceMembro.findFirst({
      where: { usuarioId },
    });

    if (existingMembership) {
      throw new ConflictException('usuário já pertence a um workspace');
    }

    await this.ensurePlanos();

    const plano = await this.prisma.plano.findFirst({ where: { tipo } });
    if (!plano) {
      throw new Error(`plano não encontrado para o tipo ${tipo}`);
    }

    const primeiroNome = usuarioNome.split(' ')[0];

    const workspace = await this.prisma.workspace.create({
      data: {
        nome: `Financeiro de ${primeiroNome}`,
        planoId: plano.id,
        membros: {
          create: { usuarioId, role: WorkspaceRole.DONO },
        },
      },
    });

    return {
      id: workspace.id,
      nome: workspace.nome,
      plano: { tipo: plano.tipo },
    };
  }

  private async ensurePlanos(): Promise<void> {
    const count = await this.prisma.plano.count();
    if (count > 0) {
      return;
    }

    await this.prisma.plano.createMany({ data: DEFAULT_PLANOS });
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test -w backend -- workspace.service`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/workspace/workspace.service.ts backend/src/workspace/workspace.service.spec.ts
git commit -m "feat: adiciona WorkspaceService.create com auto-seed de Plano"
```

---

### Task 3: `WorkspaceService.findMine()`

**Files:**
- Modify: `backend/src/workspace/workspace.service.ts` (adiciona `findMine`)
- Modify: `backend/src/workspace/workspace.service.spec.ts` (adiciona o `describe('findMine', ...)`)

**Interfaces:**
- Consumes: tudo da Task 2 (mesmo arquivo, mesma classe).
- Produces: `WorkspaceService.findMine(usuarioId: string): Promise<WorkspaceResult | null>`.

- [ ] **Step 1: Adicionar os testes de `findMine`**

Acrescente ao final de `backend/src/workspace/workspace.service.spec.ts`, dentro do mesmo `describe('WorkspaceService', ...)`, depois do bloco `describe('create', ...)`:

```ts
  describe('findMine', () => {
    it('returns null when the user has no workspace', async () => {
      const { service, prisma } = buildService();
      (prisma.workspaceMembro.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.findMine(usuarioId);

      expect(result).toBeNull();
    });

    it('returns the workspace when the user has one', async () => {
      const { service, prisma } = buildService();
      (prisma.workspaceMembro.findFirst as jest.Mock).mockResolvedValue({
        id: 'membro-1',
        workspace: {
          id: 'ws-1',
          nome: 'Financeiro de Marcos',
          plano: { tipo: PlanoTipo.INDIVIDUAL },
        },
      });

      const result = await service.findMine(usuarioId);

      expect(prisma.workspaceMembro.findFirst).toHaveBeenCalledWith({
        where: { usuarioId },
        include: { workspace: { include: { plano: true } } },
      });
      expect(result).toEqual({
        id: 'ws-1',
        nome: 'Financeiro de Marcos',
        plano: { tipo: PlanoTipo.INDIVIDUAL },
      });
    });
  });
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test -w backend -- workspace.service`
Expected: FAIL — `service.findMine is not a function`.

- [ ] **Step 3: Implementar `findMine`**

Adicione o método público em `backend/src/workspace/workspace.service.ts`, logo após `create` (antes do `private async ensurePlanos`):

```ts
  async findMine(usuarioId: string): Promise<WorkspaceResult | null> {
    const membership = await this.prisma.workspaceMembro.findFirst({
      where: { usuarioId },
      include: { workspace: { include: { plano: true } } },
    });

    if (!membership) {
      return null;
    }

    return {
      id: membership.workspace.id,
      nome: membership.workspace.nome,
      plano: { tipo: membership.workspace.plano.tipo },
    };
  }
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test -w backend -- workspace.service`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/workspace/workspace.service.ts backend/src/workspace/workspace.service.spec.ts
git commit -m "feat: adiciona WorkspaceService.findMine"
```

---

### Task 4: `WorkspaceController`, `WorkspaceModule` e integração no `AppModule`

**Files:**
- Create: `backend/src/workspace/workspace.controller.ts`
- Test: `backend/src/workspace/workspace.controller.spec.ts`
- Create: `backend/src/workspace/workspace.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `WorkspaceService` (Task 2/3), `JwtAuthGuard` (`../auth/guards/jwt-auth.guard`), `CurrentUser`/`AuthenticatedUser` (`../auth/decorators/current-user.decorator` / `../auth/strategies/jwt.strategy`), `CreateWorkspaceDto` (Task 1).
- Produces: rotas HTTP `POST /workspaces`, `GET /workspaces/me`.

- [ ] **Step 1: Escrever o teste do controller**

```ts
// backend/src/workspace/workspace.controller.spec.ts
import { NotFoundException } from '@nestjs/common';
import { PlanoTipo } from '@prisma/client';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('WorkspaceController', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    nome: 'Marcos',
    email: 'marcos@example.com',
    cpf: '11144477735',
    criadoEm: new Date(),
  };

  const workspaceResult = {
    id: 'ws-1',
    nome: 'Financeiro de Marcos',
    plano: { tipo: PlanoTipo.INDIVIDUAL },
  };

  const buildController = () => {
    const workspaceService = {
      create: jest.fn().mockResolvedValue(workspaceResult),
      findMine: jest.fn(),
    } as unknown as WorkspaceService;

    return {
      controller: new WorkspaceController(workspaceService),
      workspaceService,
    };
  };

  it('delegates create to WorkspaceService with the current user id and nome', async () => {
    const { controller, workspaceService } = buildController();

    const result = await controller.create(
      { tipo: PlanoTipo.INDIVIDUAL },
      user,
    );

    expect(workspaceService.create).toHaveBeenCalledWith(
      user.id,
      user.nome,
      PlanoTipo.INDIVIDUAL,
    );
    expect(result).toEqual(workspaceResult);
  });

  it('returns the workspace for findMine when it exists', async () => {
    const { controller, workspaceService } = buildController();
    (workspaceService.findMine as jest.Mock).mockResolvedValue(
      workspaceResult,
    );

    const result = await controller.findMine(user);

    expect(result).toEqual(workspaceResult);
  });

  it('throws NotFoundException for findMine when no workspace exists', async () => {
    const { controller, workspaceService } = buildController();
    (workspaceService.findMine as jest.Mock).mockResolvedValue(null);

    await expect(controller.findMine(user)).rejects.toThrow(
      NotFoundException,
    );
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test -w backend -- workspace.controller`
Expected: FAIL — `Cannot find module './workspace.controller'`.

- [ ] **Step 3: Implementar o controller**

```ts
// backend/src/workspace/workspace.controller.ts
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { WorkspaceResult, WorkspaceService } from './workspace.service';

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
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test -w backend -- workspace.controller`
Expected: PASS (3 testes).

- [ ] **Step 5: Criar o módulo e integrar no `AppModule`**

```ts
// backend/src/workspace/workspace.module.ts
import { Module } from '@nestjs/common';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';

@Module({
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
})
export class WorkspaceModule {}
```

```ts
// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';

@Module({
  imports: [PrismaModule, AuthModule, WorkspaceModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 6: Rodar toda a suíte unitária do backend**

Run: `npm run test -w backend`
Expected: todos os testes passam (incluindo os do módulo de auth já existentes).

- [ ] **Step 7: Commit**

```bash
git add backend/src/workspace/workspace.controller.ts backend/src/workspace/workspace.controller.spec.ts backend/src/workspace/workspace.module.ts backend/src/app.module.ts
git commit -m "feat: adiciona WorkspaceController e integra WorkspaceModule ao AppModule"
```

---

### Task 5: Teste e2e do fluxo de onboarding

**Files:**
- Create: `backend/test/workspace.e2e-spec.ts`

**Interfaces:**
- Consumes: `AppModule`, `PrismaService`, `randomValidCpf` (`./fixtures/cpf`, já existente do módulo de auth).

- [ ] **Step 1: Escrever o teste e2e**

```ts
// backend/test/workspace.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { randomValidCpf } from './fixtures/cpf';

describe('Workspace (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];
  const createdWorkspaceIds: string[] = [];

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

  async function registerAndLogin(): Promise<string> {
    const unique = `${Date.now()}-${Math.random()}`;
    const payload = {
      nome: 'Marcos Teste',
      email: `workspace-e2e-${unique}@example.com`,
      cpf: randomValidCpf(),
      senha: 'password123',
    };

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(payload)
      .expect(201);

    createdUserIds.push(response.body.usuario.id);
    return response.body.accessToken as string;
  }

  it('has no workspace right after registering', async () => {
    const accessToken = await registerAndLogin();

    await request(app.getHttpServer())
      .get('/workspaces/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('creates a workspace and returns it from /workspaces/me', async () => {
    const accessToken = await registerAndLogin();

    const createResponse = await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tipo: 'FAMILIA' })
      .expect(201);

    createdWorkspaceIds.push(createResponse.body.id);
    expect(createResponse.body.plano.tipo).toBe('FAMILIA');
    expect(createResponse.body.nome).toEqual(expect.any(String));

    const meResponse = await request(app.getHttpServer())
      .get('/workspaces/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(meResponse.body.id).toBe(createResponse.body.id);
  });

  it('rejects creating a second workspace for the same user', async () => {
    const accessToken = await registerAndLogin();

    const firstResponse = await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tipo: 'INDIVIDUAL' })
      .expect(201);
    createdWorkspaceIds.push(firstResponse.body.id);

    await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tipo: 'INDIVIDUAL' })
      .expect(409);
  });

  it('rejects an unauthenticated request', async () => {
    await request(app.getHttpServer()).get('/workspaces/me').expect(401);
  });
});
```

- [ ] **Step 2: Rodar o teste e2e**

Run: `npm run test:e2e -w backend`
Expected: PASS (4 testes em `Workspace (e2e)`, mais os suites já existentes de `AppController` e `Auth`).

- [ ] **Step 3: Commit**

```bash
git add backend/test/workspace.e2e-spec.ts
git commit -m "test: adiciona teste e2e do fluxo de criação de workspace"
```

---

### Task 6: Frontend — `ApiError` com código de status em `api.ts`

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Produces: `export class ApiError extends Error { status: number }`, lançado no lugar de `Error` genérico quando `!response.ok`.

**Por quê:** o `WorkspaceContext` (Task 7) precisa distinguir um `404` de `/workspaces/me` (significa "precisa de onboarding", não é erro) de qualquer outra falha. Hoje `api.ts` só lança `Error` com uma mensagem de texto, sem o código de status.

- [ ] **Step 1: Adicionar a classe `ApiError` e usá-la no lugar de `Error`**

Em `frontend/src/lib/api.ts`, adicione logo após a linha `const AUTH_ENDPOINTS_WITHOUT_RETRY = [...]`:

```ts
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
```

E troque o bloco `if (!response.ok) { ... }` dentro de `request()` para:

```ts
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      (body as { message?: string } | null)?.message ??
      `${init.method ?? 'GET'} ${path} failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }
```

Nada mais no arquivo muda — `ApiError extends Error`, então todo código que já faz `err instanceof Error` / `err.message` (telas de login/registro) continua funcionando sem alteração.

- [ ] **Step 2: Verificar que o frontend compila**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: sem erros de tipo.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: adiciona ApiError com status code ao cliente de API"
```

---

### Task 7: Frontend — `WorkspaceContext`

**Files:**
- Create: `frontend/src/contexts/workspace-context.tsx`

**Interfaces:**
- Consumes: `apiGet`/`apiPost`/`ApiError` (`@/lib/api`, Task 6), `useAuth` (`@/contexts/auth-context`, já existente).
- Produces: `WorkspaceProvider`, `useWorkspace(): { workspace, isLoading, createWorkspace }`, tipo exportado `PlanoTipo`.

- [ ] **Step 1: Implementar o `WorkspaceContext`**

```tsx
// frontend/src/contexts/workspace-context.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { apiGet, apiPost, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

export type PlanoTipo = 'INDIVIDUAL' | 'FAMILIA';

interface Workspace {
  id: string;
  nome: string;
  plano: { tipo: PlanoTipo };
}

interface WorkspaceContextValue {
  workspace: Workspace | null;
  isLoading: boolean;
  createWorkspace: (tipo: PlanoTipo) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { usuario } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWorkspace = useCallback(async () => {
    try {
      const result = await apiGet<Workspace>('/workspaces/me');
      setWorkspace(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setWorkspace(null);
      } else {
        throw err;
      }
    }
  }, []);

  useEffect(() => {
    if (!usuario) {
      setWorkspace(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    (async () => {
      try {
        await fetchWorkspace();
      } finally {
        setIsLoading(false);
      }
    })();
  }, [usuario, fetchWorkspace]);

  const createWorkspace = useCallback(async (tipo: PlanoTipo) => {
    const result = await apiPost<Workspace>('/workspaces', { tipo });
    setWorkspace(result);
  }, []);

  const value = useMemo(
    () => ({ workspace, isLoading, createWorkspace }),
    [workspace, isLoading, createWorkspace],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error(
      'useWorkspace deve ser usado dentro de um WorkspaceProvider',
    );
  }
  return context;
}
```

- [ ] **Step 2: Verificar que o frontend compila**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: sem erros de tipo.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/contexts/workspace-context.tsx
git commit -m "feat: adiciona WorkspaceContext"
```

---

### Task 8: Frontend — grupo de rota `(onboarding)` e gating de três estados

**Files:**
- Modify: `frontend/src/app/_layout.tsx`
- Create: `frontend/src/app/(onboarding)/_layout.tsx`
- Create: `frontend/src/app/(onboarding)/index.tsx`

**Interfaces:**
- Consumes: `WorkspaceProvider`/`useWorkspace`/`PlanoTipo` (Task 7), `AuthProvider`/`useAuth` (já existente).

- [ ] **Step 1: Criar o layout do grupo `(onboarding)`**

```tsx
// frontend/src/app/(onboarding)/_layout.tsx
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
```

- [ ] **Step 2: Criar a tela de escolha de plano**

```tsx
// frontend/src/app/(onboarding)/index.tsx
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useWorkspace } from '@/contexts/workspace-context';
import type { PlanoTipo } from '@/contexts/workspace-context';
import { Spacing } from '@/constants/theme';

export default function OnboardingScreen() {
  const { createWorkspace } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChoose = async (tipo: PlanoTipo) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await createWorkspace(tipo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao criar workspace');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">Como você vai usar o app?</ThemedText>

        <Pressable
          onPress={() => handleChoose('INDIVIDUAL')}
          disabled={isSubmitting}
          style={styles.card}>
          <ThemedText type="smallBold">Individual</ThemedText>
          <ThemedText type="small">
            Uso solo, com opção de convidar alguém depois.
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => handleChoose('FAMILIA')}
          disabled={isSubmitting}
          style={styles.card}>
          <ThemedText type="smallBold">Família / Casal</ThemedText>
          <ThemedText type="small">
            Carteira compartilhada, com identificação de quem registrou cada
            movimentação.
          </ThemedText>
        </Pressable>

        {error && <ThemedText themeColor="textSecondary">{error}</ThemedText>}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  card: {
    borderWidth: 1,
    borderColor: '#8888',
    borderRadius: Spacing.two,
    padding: Spacing.four,
    gap: Spacing.one,
  },
});
```

- [ ] **Step 3: Atualizar o layout raiz pro gating de três estados**

```tsx
// frontend/src/app/_layout.tsx
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { WorkspaceProvider, useWorkspace } from '@/contexts/workspace-context';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading: authLoading, usuario } = useAuth();
  const { isLoading: workspaceLoading, workspace } = useWorkspace();

  if (authLoading) {
    return null;
  }

  if (usuario && workspaceLoading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!usuario && !!workspace}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!!usuario && !workspace}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={!usuario}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <AnimatedSplashOverlay />
        <RootNavigator />
      </WorkspaceProvider>
    </AuthProvider>
  );
}
```

- [ ] **Step 4: Verificar que o frontend compila**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app
git commit -m "feat: adiciona tela de onboarding e gating de três estados (auth/onboarding/app)"
```

---

### Task 9: Verificação manual de ponta a ponta

**Files:** nenhum (só validação)

- [ ] **Step 1: Subir o backend e o app**

```bash
npm run db:up
npm run dev:backend
```

Em outro terminal: `npm run dev:frontend` (ou `npx expo start --web` dentro de `frontend/`).

- [ ] **Step 2: Testar o fluxo completo**

Registre uma conta nova (ou logue numa que não tenha workspace ainda). Confirme que o app cai na tela de onboarding (não no `(app)` nem no `(auth)`). Escolha "Individual" ou "Família / Casal" e confirme que, depois, o app navega sozinho pro `(app)` (tela Home com tabs).

- [ ] **Step 3: Testar persistência**

Feche e reabra o app (ou dê reload na aba). Confirme que ele vai direto pro `(app)`, sem passar pela tela de onboarding de novo (prova que `GET /workspaces/me` está retornando o workspace certo).

- [ ] **Step 4: Testar o bloqueio de workspace duplicado**

Com uma conta que já tem workspace, tente chamar `POST /workspaces` de novo (via curl, com o access token dela) e confirme `409`.

Nenhum commit nesta task — é validação manual do que já foi commitado nas tasks anteriores. Se algum passo falhar, volte pra task correspondente, corrija e re-commit.
