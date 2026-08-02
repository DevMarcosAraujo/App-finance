# Relatórios (PDF) + Identidade Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um módulo full-stack de Relatórios (geração de PDF mensal/bimestral/semestral/anual do core financeiro) e introduzir uma cor de destaque (accent) própria no design system do frontend, aplicada primeiro na nova tela de Relatórios.

**Architecture:** Backend NestJS: novo módulo `relatorio/` que agrega `Transacao` por workspace/período, renderiza um PDF com `@react-pdf/renderer`, salva em disco local (`backend/storage/relatorios/`) e expõe rotas REST (`POST /relatorios`, `GET /relatorios`, `GET /relatorios/:id/arquivo`) atrás dos guards de auth/workspace já existentes. Frontend Expo Router: nova aba "Relatórios" que gera/lista relatórios via um client HTTP dedicado, baixando o PDF via `expo-sharing` (mobile) ou download direto (web).

**Tech Stack:** NestJS + Prisma (backend), `@react-pdf/renderer` (geração de PDF), React Native + Expo Router (frontend), `expo-sharing` + `expo-file-system` (download/compartilhamento mobile).

## Global Constraints

- Nunca hardcodar regra fiscal no código — não se aplica a este módulo (agregação de `Transacao` é soma direta, sem cálculo fiscal).
- Seguir o padrão de módulos existentes (`transacao/`, `carne-leao/`): controller + service + dto + `.spec.ts` + `*.module.ts`.
- `JwtAuthGuard` + `WorkspaceGuard` em todos os endpoints, resolvendo `workspaceId` via `@CurrentWorkspace()`.
- Sem novas dependências de estilo no frontend (sem Tailwind/NativeWind) — continuar com `StyleSheet` + `ThemedText`/`ThemedView`.
- Escopo desta rodada: só core financeiro no relatório (sem PJ/carnê-leão), e a nova paleta `accent`/`accentSoft` só é aplicada na tela de Relatórios (não no resto do app).

---

## File Structure

**Backend — novo módulo `backend/src/relatorio/`:**
- `relatorio.service.ts` — agregação de transações + orquestração de geração/storage do PDF.
- `relatorio.pdf.tsx` — componente puro `@react-pdf/renderer` (sem I/O).
- `relatorio.controller.ts` — rotas REST.
- `relatorio.module.ts` — registro do módulo.
- `dto/gerar-relatorio.dto.ts` — validação do body de `POST /relatorios`.
- `relatorio.service.spec.ts`, `relatorio.controller.spec.ts`.

**Modificado:**
- `backend/src/app.module.ts` — importar `RelatorioModule`.
- `backend/.gitignore` (novo arquivo) — ignorar `storage/`.
- `frontend/src/constants/theme.ts` — adicionar `accent`/`accentSoft`.
- `frontend/src/lib/api.ts` — adicionar `apiGetBlob` para download binário autenticado.
- `frontend/src/components/app-tabs.tsx` e `app-tabs.web.tsx` — nova aba Relatórios.

**Frontend — novos arquivos:**
- `frontend/src/lib/relatorios-api.ts` — client HTTP.
- `frontend/src/hooks/use-relatorios.ts` — hook de listagem.
- `frontend/src/app/(app)/(tabs)/relatorios.tsx` — tela.

---

### Task 1: Dependências novas

**Files:**
- Modify: `backend/package.json`
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: `@react-pdf/renderer` (e seu peer dependency `react`) disponível em `backend/`; `expo-sharing` e `expo-file-system` disponíveis em `frontend/`.

- [ ] **Step 1: Instalar `@react-pdf/renderer` e `react` no backend**

`@react-pdf/renderer` exige `react` como peer dependency, que o backend NestJS não tem hoje (é só um consumidor de JSX puro via `React.createElement`, sem app React nenhum rodando — ver Task 3).

Run: `cd backend && npm install @react-pdf/renderer react`

- [ ] **Step 2: Instalar `expo-sharing` e `expo-file-system` no frontend**

Run: `cd frontend && npx expo install expo-sharing expo-file-system`

- [ ] **Step 3: Verificar que os projetos ainda buildam/testam**

Run: `cd backend && npm test -- --passWithNoTests` (deve passar, nenhum teste novo ainda)
Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add backend/package.json backend/package-lock.json frontend/package.json frontend/package-lock.json
git commit -m "chore: adiciona dependências de geração de PDF e compartilhamento de arquivo"
```

---

### Task 2: `RelatorioService` — agregação de transações

**Files:**
- Create: `backend/src/relatorio/relatorio.service.ts`
- Test: `backend/src/relatorio/relatorio.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (`backend/src/prisma/prisma.service.ts`), modelo `Transacao` (`workspaceId`, `tipo: 'RECEITA'|'DESPESA'`, `valor: Decimal`, `categoriaId`, `data`), modelo `Categoria` (`id`, `nome`).
- Produces:
  ```ts
  export interface RelatorioAgregado {
    totalReceitas: number;
    totalDespesas: number;
    saldo: number;
    porCategoria: Array<{
      categoriaId: string | null;
      categoriaNome: string;
      totalReceitas: number;
      totalDespesas: number;
    }>;
  }

  class RelatorioService {
    agregar(workspaceId: string, periodoInicio: Date, periodoFim: Date): Promise<RelatorioAgregado>
  }
  ```
  Usado pela Task 3 (renderização do PDF) e Task 4 (orquestração).

- [ ] **Step 1: Escrever o teste da agregação**

```ts
// backend/src/relatorio/relatorio.service.spec.ts
import { TransacaoTipo } from '@prisma/client';
import { RelatorioService } from './relatorio.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RelatorioService', () => {
  const workspaceId = 'ws-1';

  const buildService = () => {
    const prisma = {
      transacao: { findMany: jest.fn() },
    } as unknown as PrismaService;

    return { service: new RelatorioService(prisma), prisma };
  };

  describe('agregar', () => {
    it('soma receitas e despesas por categoria dentro do período', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.findMany as jest.Mock).mockResolvedValue([
        {
          tipo: TransacaoTipo.RECEITA,
          valor: '1000.00',
          categoriaId: 'cat-1',
          categoria: { id: 'cat-1', nome: 'Salário' },
        },
        {
          tipo: TransacaoTipo.DESPESA,
          valor: '200.50',
          categoriaId: 'cat-2',
          categoria: { id: 'cat-2', nome: 'Mercado' },
        },
        {
          tipo: TransacaoTipo.DESPESA,
          valor: '99.50',
          categoriaId: 'cat-2',
          categoria: { id: 'cat-2', nome: 'Mercado' },
        },
        {
          tipo: TransacaoTipo.DESPESA,
          valor: '50.00',
          categoriaId: null,
          categoria: null,
        },
      ]);

      const inicio = new Date('2026-07-01T00:00:00.000Z');
      const fim = new Date('2026-08-01T00:00:00.000Z');
      const result = await service.agregar(workspaceId, inicio, fim);

      expect(prisma.transacao.findMany).toHaveBeenCalledWith({
        where: { workspaceId, data: { gte: inicio, lt: fim } },
        include: { categoria: true },
      });

      expect(result.totalReceitas).toBe(1000);
      expect(result.totalDespesas).toBe(350);
      expect(result.saldo).toBe(650);
      expect(result.porCategoria).toEqual(
        expect.arrayContaining([
          {
            categoriaId: 'cat-1',
            categoriaNome: 'Salário',
            totalReceitas: 1000,
            totalDespesas: 0,
          },
          {
            categoriaId: 'cat-2',
            categoriaNome: 'Mercado',
            totalReceitas: 0,
            totalDespesas: 300,
          },
          {
            categoriaId: null,
            categoriaNome: 'Sem categoria',
            totalReceitas: 0,
            totalDespesas: 50,
          },
        ]),
      );
      expect(result.porCategoria).toHaveLength(3);
    });

    it('retorna agregação zerada quando não há transações no período', async () => {
      const { service, prisma } = buildService();
      (prisma.transacao.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.agregar(
        workspaceId,
        new Date('2026-07-01T00:00:00.000Z'),
        new Date('2026-08-01T00:00:00.000Z'),
      );

      expect(result).toEqual({
        totalReceitas: 0,
        totalDespesas: 0,
        saldo: 0,
        porCategoria: [],
      });
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e verificar que falha**

Run: `cd backend && npx jest relatorio.service --no-coverage`
Expected: FAIL — `Cannot find module './relatorio.service'`

- [ ] **Step 3: Implementar `RelatorioService`**

```ts
// backend/src/relatorio/relatorio.service.ts
import { Injectable } from '@nestjs/common';
import { TransacaoTipo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RelatorioAgregadoCategoria {
  categoriaId: string | null;
  categoriaNome: string;
  totalReceitas: number;
  totalDespesas: number;
}

export interface RelatorioAgregado {
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
  porCategoria: RelatorioAgregadoCategoria[];
}

interface RawTransacaoAgregacao {
  tipo: TransacaoTipo;
  valor: unknown;
  categoriaId: string | null;
  categoria: { id: string; nome: string } | null;
}

@Injectable()
export class RelatorioService {
  constructor(private readonly prisma: PrismaService) {}

  async agregar(
    workspaceId: string,
    periodoInicio: Date,
    periodoFim: Date,
  ): Promise<RelatorioAgregado> {
    const transacoes = await this.prisma.transacao.findMany({
      where: { workspaceId, data: { gte: periodoInicio, lt: periodoFim } },
      include: { categoria: true },
    });

    const porCategoriaMap = new Map<string, RelatorioAgregadoCategoria>();
    let totalReceitas = 0;
    let totalDespesas = 0;

    for (const transacao of transacoes as RawTransacaoAgregacao[]) {
      const valor = Number(transacao.valor);
      const chave = transacao.categoriaId ?? 'sem-categoria';
      const nome = transacao.categoria?.nome ?? 'Sem categoria';

      if (!porCategoriaMap.has(chave)) {
        porCategoriaMap.set(chave, {
          categoriaId: transacao.categoriaId,
          categoriaNome: nome,
          totalReceitas: 0,
          totalDespesas: 0,
        });
      }
      const entry = porCategoriaMap.get(chave)!;

      if (transacao.tipo === TransacaoTipo.RECEITA) {
        totalReceitas += valor;
        entry.totalReceitas += valor;
      } else {
        totalDespesas += valor;
        entry.totalDespesas += valor;
      }
    }

    return {
      totalReceitas,
      totalDespesas,
      saldo: totalReceitas - totalDespesas,
      porCategoria: Array.from(porCategoriaMap.values()),
    };
  }
}
```

- [ ] **Step 4: Rodar o teste e verificar que passa**

Run: `cd backend && npx jest relatorio.service --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/relatorio/relatorio.service.ts backend/src/relatorio/relatorio.service.spec.ts
git commit -m "feat: adiciona agregação de transações para relatórios"
```

---

### Task 3: Componente de PDF (`relatorio.pdf.tsx`)

**Files:**
- Create: `backend/src/relatorio/relatorio.pdf.tsx`
- Test: `backend/src/relatorio/relatorio.pdf.spec.ts`

**Interfaces:**
- Consumes: `RelatorioAgregado` (Task 2), `TipoRelatorio` de `@prisma/client`.
- Produces:
  ```ts
  export interface RelatorioPdfDados {
    tipo: TipoRelatorio;
    periodoInicio: Date;
    periodoFim: Date;
    agregado: RelatorioAgregado;
  }

  export function renderRelatorioPdf(dados: RelatorioPdfDados): Promise<Buffer>
  ```
  Usado pela Task 4 (`RelatorioService`/orquestração de geração, ou um serviço dedicado).

**Nota:** este arquivo precisa de `"jsx": "react-jsx"` disponível — o backend NestJS por padrão não compila JSX. Para evitar mexer no `tsconfig.json` do projeto inteiro (que afetaria todo o backend), este componente usa `React.createElement` diretamente, sem sintaxe JSX.

- [ ] **Step 1: Escrever o teste**

```ts
// backend/src/relatorio/relatorio.pdf.spec.ts
import { TipoRelatorio } from '@prisma/client';
import { renderRelatorioPdf } from './relatorio.pdf';

describe('renderRelatorioPdf', () => {
  it('gera um buffer de PDF válido para uma agregação com dados', async () => {
    const buffer = await renderRelatorioPdf({
      tipo: TipoRelatorio.MENSAL,
      periodoInicio: new Date('2026-07-01T00:00:00.000Z'),
      periodoFim: new Date('2026-08-01T00:00:00.000Z'),
      agregado: {
        totalReceitas: 1000,
        totalDespesas: 350,
        saldo: 650,
        porCategoria: [
          {
            categoriaId: 'cat-1',
            categoriaNome: 'Salário',
            totalReceitas: 1000,
            totalDespesas: 0,
          },
        ],
      },
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('gera um buffer de PDF válido para agregação vazia', async () => {
    const buffer = await renderRelatorioPdf({
      tipo: TipoRelatorio.ANUAL,
      periodoInicio: new Date('2026-01-01T00:00:00.000Z'),
      periodoFim: new Date('2027-01-01T00:00:00.000Z'),
      agregado: {
        totalReceitas: 0,
        totalDespesas: 0,
        saldo: 0,
        porCategoria: [],
      },
    });

    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });
});
```

- [ ] **Step 2: Rodar o teste e verificar que falha**

Run: `cd backend && npx jest relatorio.pdf --no-coverage`
Expected: FAIL — `Cannot find module './relatorio.pdf'`

- [ ] **Step 3: Implementar o componente**

```tsx
// backend/src/relatorio/relatorio.pdf.tsx
import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import { TipoRelatorio } from '@prisma/client';
import type { RelatorioAgregado } from './relatorio.service';

export interface RelatorioPdfDados {
  tipo: TipoRelatorio;
  periodoInicio: Date;
  periodoFim: Date;
  agregado: RelatorioAgregado;
}

const TIPO_LABEL: Record<TipoRelatorio, string> = {
  MENSAL: 'Mensal',
  BIMESTRAL: 'Bimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11 },
  titulo: { fontSize: 18, marginBottom: 4 },
  periodo: { fontSize: 11, marginBottom: 16, color: '#666' },
  totaisRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  totalItem: { flexDirection: 'column' },
  totalLabel: { fontSize: 9, color: '#666' },
  totalValor: { fontSize: 14, marginTop: 2 },
  tabelaHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 4,
    marginBottom: 4,
  },
  tabelaRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
  },
  colNome: { flex: 2 },
  colValor: { flex: 1, textAlign: 'right' },
  vazio: { marginTop: 16, color: '#666' },
});

function formatMoeda(valor: number): string {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`;
}

function formatData(data: Date): string {
  return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function RelatorioDocument({ tipo, periodoInicio, periodoFim, agregado }: RelatorioPdfDados) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(
        Text,
        { style: styles.titulo },
        `Relatório ${TIPO_LABEL[tipo]}`,
      ),
      React.createElement(
        Text,
        { style: styles.periodo },
        `${formatData(periodoInicio)} a ${formatData(periodoFim)}`,
      ),
      React.createElement(
        View,
        { style: styles.totaisRow },
        React.createElement(
          View,
          { style: styles.totalItem },
          React.createElement(Text, { style: styles.totalLabel }, 'Receitas'),
          React.createElement(Text, { style: styles.totalValor }, formatMoeda(agregado.totalReceitas)),
        ),
        React.createElement(
          View,
          { style: styles.totalItem },
          React.createElement(Text, { style: styles.totalLabel }, 'Despesas'),
          React.createElement(Text, { style: styles.totalValor }, formatMoeda(agregado.totalDespesas)),
        ),
        React.createElement(
          View,
          { style: styles.totalItem },
          React.createElement(Text, { style: styles.totalLabel }, 'Saldo'),
          React.createElement(Text, { style: styles.totalValor }, formatMoeda(agregado.saldo)),
        ),
      ),
      agregado.porCategoria.length === 0
        ? React.createElement(
            Text,
            { style: styles.vazio },
            'Nenhuma transação registrada neste período.',
          )
        : React.createElement(
            View,
            null,
            React.createElement(
              View,
              { style: styles.tabelaHeader },
              React.createElement(Text, { style: styles.colNome }, 'Categoria'),
              React.createElement(Text, { style: styles.colValor }, 'Receitas'),
              React.createElement(Text, { style: styles.colValor }, 'Despesas'),
            ),
            ...agregado.porCategoria.map((categoria) =>
              React.createElement(
                View,
                { key: categoria.categoriaId ?? 'sem-categoria', style: styles.tabelaRow },
                React.createElement(Text, { style: styles.colNome }, categoria.categoriaNome),
                React.createElement(Text, { style: styles.colValor }, formatMoeda(categoria.totalReceitas)),
                React.createElement(Text, { style: styles.colValor }, formatMoeda(categoria.totalDespesas)),
              ),
            ),
          ),
    ),
  );
}

export function renderRelatorioPdf(dados: RelatorioPdfDados): Promise<Buffer> {
  return renderToBuffer(React.createElement(RelatorioDocument, dados));
}
```

- [ ] **Step 4: Rodar o teste e verificar que passa**

Run: `cd backend && npx jest relatorio.pdf --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/relatorio/relatorio.pdf.tsx backend/src/relatorio/relatorio.pdf.spec.ts
git commit -m "feat: adiciona componente de renderização de PDF do relatório"
```

---

### Task 4: Storage em disco + orquestração de geração

**Files:**
- Modify: `backend/src/relatorio/relatorio.service.ts`
- Modify: `backend/src/relatorio/relatorio.service.spec.ts`
- Create: `backend/.gitignore`

**Interfaces:**
- Consumes: `renderRelatorioPdf` (Task 3), `agregar` (já implementado nesta mesma classe).
- Produces:
  ```ts
  interface GerarRelatorioInput {
    tipo: TipoRelatorio;
    periodoInicio: Date;
    periodoFim: Date;
  }

  interface RelatorioGeradoResult {
    id: string;
    tipo: TipoRelatorio;
    periodoInicio: Date;
    periodoFim: Date;
    arquivoPdfUrl: string;
    geradoEm: Date;
  }

  class RelatorioService {
    gerar(workspaceId: string, input: GerarRelatorioInput): Promise<RelatorioGeradoResult>
    listar(workspaceId: string): Promise<RelatorioGeradoResult[]>
    buscarArquivo(workspaceId: string, id: string): Promise<Buffer>
  }
  ```
  `RelatorioGeradoResult` e as 3 assinaturas públicas são consumidas pela Task 5 (`RelatorioController`).

- [ ] **Step 1: Escrever os testes para `gerar`, `listar`, `buscarArquivo`**

Adicionar ao final de `backend/src/relatorio/relatorio.service.spec.ts` (dentro do mesmo `describe('RelatorioService')`, fora do bloco `describe('agregar')`):

```ts
import { TipoRelatorio } from '@prisma/client';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { NotFoundException } from '@nestjs/common';

// ... (mantém o describe('agregar') existente acima)

describe('gerar / listar / buscarArquivo', () => {
  const workspaceId = 'ws-1';
  let storageDir: string;

  const buildService = () => {
    const prisma = {
      transacao: { findMany: jest.fn().mockResolvedValue([]) },
      relatorioGerado: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    } as unknown as PrismaService;

    const service = new RelatorioService(prisma);
    (service as unknown as { storageDir: string }).storageDir = storageDir;

    return { service, prisma };
  };

  beforeEach(async () => {
    storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'relatorios-test-'));
  });

  afterEach(async () => {
    await fs.rm(storageDir, { recursive: true, force: true });
  });

  it('gera o PDF, salva em disco (nomeado com o id do registro) e persiste o registro', async () => {
    const { service, prisma } = buildService();
    (prisma.relatorioGerado.create as jest.Mock).mockResolvedValue({
      id: 'rel-1',
      tipo: TipoRelatorio.MENSAL,
      periodoInicio: new Date('2026-07-01T00:00:00.000Z'),
      periodoFim: new Date('2026-08-01T00:00:00.000Z'),
      arquivoPdfUrl: '',
      geradoEm: new Date('2026-08-02T00:00:00.000Z'),
    });
    (prisma.relatorioGerado.update as jest.Mock).mockResolvedValue({
      id: 'rel-1',
      tipo: TipoRelatorio.MENSAL,
      periodoInicio: new Date('2026-07-01T00:00:00.000Z'),
      periodoFim: new Date('2026-08-01T00:00:00.000Z'),
      arquivoPdfUrl: '/relatorios/rel-1/arquivo',
      geradoEm: new Date('2026-08-02T00:00:00.000Z'),
    });

    const result = await service.gerar(workspaceId, {
      tipo: TipoRelatorio.MENSAL,
      periodoInicio: new Date('2026-07-01T00:00:00.000Z'),
      periodoFim: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(result.id).toBe('rel-1');
    expect(result.arquivoPdfUrl).toBe('/relatorios/rel-1/arquivo');
    expect(prisma.relatorioGerado.update).toHaveBeenCalledWith({
      where: { id: 'rel-1' },
      data: { arquivoPdfUrl: '/relatorios/rel-1/arquivo' },
    });

    const arquivos = await fs.readdir(path.join(storageDir, workspaceId));
    expect(arquivos).toEqual(['rel-1.pdf']);
  });

  it('lista relatórios do workspace', async () => {
    const { service, prisma } = buildService();
    (prisma.relatorioGerado.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'rel-1',
        tipo: TipoRelatorio.MENSAL,
        periodoInicio: new Date('2026-07-01T00:00:00.000Z'),
        periodoFim: new Date('2026-08-01T00:00:00.000Z'),
        arquivoPdfUrl: '/relatorios/rel-1/arquivo',
        geradoEm: new Date('2026-08-02T00:00:00.000Z'),
      },
    ]);

    const result = await service.listar(workspaceId);

    expect(prisma.relatorioGerado.findMany).toHaveBeenCalledWith({
      where: { workspaceId },
      orderBy: { geradoEm: 'desc' },
    });
    expect(result).toHaveLength(1);
  });

  it('busca o arquivo de um relatório pertencente ao workspace', async () => {
    const { service, prisma } = buildService();
    (prisma.relatorioGerado.create as jest.Mock).mockResolvedValue({
      id: 'rel-1',
      tipo: TipoRelatorio.MENSAL,
      periodoInicio: new Date('2026-07-01T00:00:00.000Z'),
      periodoFim: new Date('2026-08-01T00:00:00.000Z'),
      arquivoPdfUrl: '',
      geradoEm: new Date('2026-08-02T00:00:00.000Z'),
    });
    (prisma.relatorioGerado.update as jest.Mock).mockResolvedValue({
      id: 'rel-1',
      tipo: TipoRelatorio.MENSAL,
      periodoInicio: new Date('2026-07-01T00:00:00.000Z'),
      periodoFim: new Date('2026-08-01T00:00:00.000Z'),
      arquivoPdfUrl: '/relatorios/rel-1/arquivo',
      geradoEm: new Date('2026-08-02T00:00:00.000Z'),
    });
    await service.gerar(workspaceId, {
      tipo: TipoRelatorio.MENSAL,
      periodoInicio: new Date('2026-07-01T00:00:00.000Z'),
      periodoFim: new Date('2026-08-01T00:00:00.000Z'),
    });
    (prisma.relatorioGerado.findUnique as jest.Mock).mockResolvedValue({
      id: 'rel-1',
      workspaceId,
    });

    const buffer = await service.buscarArquivo(workspaceId, 'rel-1');

    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('lança NotFoundException ao buscar arquivo de outro workspace', async () => {
    const { service, prisma } = buildService();
    (prisma.relatorioGerado.findUnique as jest.Mock).mockResolvedValue({
      id: 'rel-1',
      workspaceId: 'outro-workspace',
    });

    await expect(service.buscarArquivo(workspaceId, 'rel-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lança NotFoundException quando o relatório não existe', async () => {
    const { service, prisma } = buildService();
    (prisma.relatorioGerado.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      service.buscarArquivo(workspaceId, 'rel-inexistente'),
    ).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Rodar os testes e verificar que falham**

Run: `cd backend && npx jest relatorio.service --no-coverage`
Expected: FAIL — `service.gerar is not a function`

- [ ] **Step 3: Implementar `gerar`, `listar`, `buscarArquivo` no `RelatorioService`**

Adicionar ao topo de `backend/src/relatorio/relatorio.service.ts` (junto aos imports existentes da Task 2):

```ts
import { NotFoundException } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { renderRelatorioPdf } from './relatorio.pdf';
```

`TipoRelatorio` já vem do import existente de `@prisma/client` — só adicionar `TipoRelatorio` ao lado de `TransacaoTipo` nesse import.

Adicionar as novas interfaces e o storage/métodos à classe `RelatorioService` já existente (mantendo `agregar` como está, sem alteração):

```ts
export interface GerarRelatorioInput {
  tipo: TipoRelatorio;
  periodoInicio: Date;
  periodoFim: Date;
}

export interface RelatorioGeradoResult {
  id: string;
  tipo: TipoRelatorio;
  periodoInicio: Date;
  periodoFim: Date;
  arquivoPdfUrl: string;
  geradoEm: Date;
}

interface RawRelatorioGerado {
  id: string;
  tipo: TipoRelatorio;
  periodoInicio: Date;
  periodoFim: Date;
  arquivoPdfUrl: string;
  geradoEm: Date;
}
```

Dentro da classe `RelatorioService`, adicionar o campo de storage e os três métodos novos:

```ts
private readonly storageDir = path.join(process.cwd(), 'storage', 'relatorios');

async gerar(
  workspaceId: string,
  input: GerarRelatorioInput,
): Promise<RelatorioGeradoResult> {
  const agregado = await this.agregar(
    workspaceId,
    input.periodoInicio,
    input.periodoFim,
  );
  const buffer = await renderRelatorioPdf({
    tipo: input.tipo,
    periodoInicio: input.periodoInicio,
    periodoFim: input.periodoFim,
    agregado,
  });

  // Cria o registro primeiro (sem arquivoPdfUrl) porque a URL pública usa o
  // id do registro, não um identificador gerado à parte — evita manter dois
  // ids diferentes (arquivo em disco x registro) para a mesma entidade.
  const relatorio = await this.prisma.relatorioGerado.create({
    data: {
      workspaceId,
      tipo: input.tipo,
      periodoInicio: input.periodoInicio,
      periodoFim: input.periodoFim,
      arquivoPdfUrl: '',
    },
  });

  const workspaceDir = path.join(this.storageDir, workspaceId);
  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.writeFile(path.join(workspaceDir, `${relatorio.id}.pdf`), buffer);

  const atualizado = await this.prisma.relatorioGerado.update({
    where: { id: relatorio.id },
    data: { arquivoPdfUrl: `/relatorios/${relatorio.id}/arquivo` },
  });

  return this.toRelatorioResult(atualizado);
}

async listar(workspaceId: string): Promise<RelatorioGeradoResult[]> {
  const relatorios = await this.prisma.relatorioGerado.findMany({
    where: { workspaceId },
    orderBy: { geradoEm: 'desc' },
  });
  return relatorios.map((relatorio) => this.toRelatorioResult(relatorio));
}

async buscarArquivo(workspaceId: string, id: string): Promise<Buffer> {
  const relatorio = await this.prisma.relatorioGerado.findUnique({
    where: { id },
  });
  if (!relatorio || relatorio.workspaceId !== workspaceId) {
    throw new NotFoundException('relatório não encontrado');
  }

  const caminho = path.join(this.storageDir, workspaceId, `${relatorio.id}.pdf`);
  return fs.readFile(caminho);
}

private toRelatorioResult(relatorio: RawRelatorioGerado): RelatorioGeradoResult {
  return {
    id: relatorio.id,
    tipo: relatorio.tipo,
    periodoInicio: relatorio.periodoInicio,
    periodoFim: relatorio.periodoFim,
    arquivoPdfUrl: relatorio.arquivoPdfUrl,
    geradoEm: relatorio.geradoEm,
  };
}
```

(`toRelatorioResult` tem nome distinto de qualquer método de `TransacaoService` — não há conflito de nomes entre os dois services.)

- [ ] **Step 4: Rodar os testes e verificar que passam**

Run: `cd backend && npx jest relatorio.service --no-coverage`
Expected: PASS

- [ ] **Step 5: Criar `backend/.gitignore` para a pasta de storage**

```
storage/
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/relatorio/relatorio.service.ts backend/src/relatorio/relatorio.service.spec.ts backend/.gitignore
git commit -m "feat: adiciona geração, listagem e storage de relatórios em disco"
```

---

### Task 5: `RelatorioController` + DTO + módulo

**Files:**
- Create: `backend/src/relatorio/dto/gerar-relatorio.dto.ts`
- Create: `backend/src/relatorio/relatorio.controller.ts`
- Create: `backend/src/relatorio/relatorio.module.ts`
- Test: `backend/src/relatorio/relatorio.controller.spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `RelatorioService.gerar/listar/buscarArquivo` (Task 4), `JwtAuthGuard` (`backend/src/auth/guards/jwt-auth.guard.ts`), `WorkspaceGuard` (`backend/src/workspace/guards/workspace.guard.ts`), `CurrentWorkspace` (`backend/src/workspace/decorators/current-workspace.decorator.ts`), `WorkspaceModule`.
- Produces: rotas `POST /relatorios`, `GET /relatorios`, `GET /relatorios/:id/arquivo` — consumidas pelo frontend na Task 7.

- [ ] **Step 1: Criar o DTO**

```ts
// backend/src/relatorio/dto/gerar-relatorio.dto.ts
import { IsDateString, IsEnum } from 'class-validator';
import { TipoRelatorio } from '@prisma/client';

export class GerarRelatorioDto {
  @IsEnum(TipoRelatorio)
  tipo: TipoRelatorio;

  @IsDateString()
  periodoInicio: string;

  @IsDateString()
  periodoFim: string;
}
```

- [ ] **Step 2: Escrever o teste do controller**

```ts
// backend/src/relatorio/relatorio.controller.spec.ts
import { Response } from 'express';
import { TipoRelatorio } from '@prisma/client';
import { RelatorioController } from './relatorio.controller';
import { RelatorioService } from './relatorio.service';
import { WorkspaceResult } from '../workspace/workspace.service';

describe('RelatorioController', () => {
  const workspace: WorkspaceResult = {
    id: 'ws-1',
    nome: 'Financeiro de Marcos',
    plano: { tipo: 'INDIVIDUAL' },
  };

  const buildController = () => {
    const relatorioService = {
      gerar: jest.fn(),
      listar: jest.fn(),
      buscarArquivo: jest.fn(),
    } as unknown as RelatorioService;

    return {
      controller: new RelatorioController(relatorioService),
      relatorioService,
    };
  };

  it('delegates gerar with the workspace id and período convertido em Date', async () => {
    const { controller, relatorioService } = buildController();
    (relatorioService.gerar as jest.Mock).mockResolvedValue({ id: 'rel-1' });

    await controller.gerar(
      {
        tipo: TipoRelatorio.MENSAL,
        periodoInicio: '2026-07-01',
        periodoFim: '2026-08-01',
      },
      workspace,
    );

    expect(relatorioService.gerar).toHaveBeenCalledWith(workspace.id, {
      tipo: TipoRelatorio.MENSAL,
      periodoInicio: new Date('2026-07-01'),
      periodoFim: new Date('2026-08-01'),
    });
  });

  it('delegates listar with the workspace id', async () => {
    const { controller, relatorioService } = buildController();
    (relatorioService.listar as jest.Mock).mockResolvedValue([]);

    await controller.listar(workspace);

    expect(relatorioService.listar).toHaveBeenCalledWith(workspace.id);
  });

  it('delegates buscarArquivo and streams the PDF buffer', async () => {
    const { controller, relatorioService } = buildController();
    const buffer = Buffer.from('%PDF-fake');
    (relatorioService.buscarArquivo as jest.Mock).mockResolvedValue(buffer);
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as unknown as Response;

    await controller.baixarArquivo('rel-1', workspace, res);

    expect(relatorioService.buscarArquivo).toHaveBeenCalledWith(
      workspace.id,
      'rel-1',
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/pdf',
    );
    expect(res.send).toHaveBeenCalledWith(buffer);
  });
});
```

- [ ] **Step 3: Rodar o teste e verificar que falha**

Run: `cd backend && npx jest relatorio.controller --no-coverage`
Expected: FAIL — `Cannot find module './relatorio.controller'`

- [ ] **Step 4: Implementar o controller**

```ts
// backend/src/relatorio/relatorio.controller.ts
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
```

- [ ] **Step 5: Rodar o teste e verificar que passa**

Run: `cd backend && npx jest relatorio.controller --no-coverage`
Expected: PASS

- [ ] **Step 6: Criar o módulo e registrar no `AppModule`**

```ts
// backend/src/relatorio/relatorio.module.ts
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
```

Modificar `backend/src/app.module.ts`: adicionar `import { RelatorioModule } from './relatorio/relatorio.module';` e incluir `RelatorioModule` no array `imports`.

- [ ] **Step 7: Rodar toda a suíte do backend**

Run: `cd backend && npm test`
Expected: PASS (todos os testes, incluindo os módulos existentes)

- [ ] **Step 8: Commit**

```bash
git add backend/src/relatorio/dto/gerar-relatorio.dto.ts backend/src/relatorio/relatorio.controller.ts backend/src/relatorio/relatorio.controller.spec.ts backend/src/relatorio/relatorio.module.ts backend/src/app.module.ts
git commit -m "feat: expõe rotas REST do módulo de relatórios"
```

---

### Task 6: Paleta `accent`/`accentSoft` no design system

**Files:**
- Modify: `frontend/src/constants/theme.ts`

**Interfaces:**
- Produces: `Colors.light.accent`, `Colors.light.accentSoft`, `Colors.dark.accent`, `Colors.dark.accentSoft` — novas chaves de `ThemeColor`, consumidas pela Task 8 (tela de Relatórios) via `useTheme()`/`ThemedText themeColor="accent"`/`ThemedView type="accentSoft"`.

- [ ] **Step 1: Adicionar as cores ao `theme.ts`**

Modificar `frontend/src/constants/theme.ts`:

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
    accent: '#7C3AED',
    accentSoft: '#EDE4FD',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    income: '#4ADE80',
    expense: '#F87171',
    accent: '#A78BFA',
    accentSoft: '#2E2447',
  },
} as const;
```

- [ ] **Step 2: Verificar que o projeto ainda compila (tipos)**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros — `ThemeColor` é derivado automaticamente das chaves de `Colors.light`/`Colors.dark`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/constants/theme.ts
git commit -m "feat: adiciona cor de destaque (accent) ao design system"
```

---

### Task 7: Frontend — client HTTP + hook

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/relatorios-api.ts`
- Create: `frontend/src/hooks/use-relatorios.ts`

**Interfaces:**
- Consumes: `apiPost`, `apiGet` (`frontend/src/lib/api.ts`), nova `apiGetBlob`.
- Produces:
  ```ts
  export type TipoRelatorio = 'MENSAL' | 'BIMESTRAL' | 'SEMESTRAL' | 'ANUAL';

  export interface RelatorioGerado {
    id: string;
    tipo: TipoRelatorio;
    periodoInicio: string;
    periodoFim: string;
    arquivoPdfUrl: string;
    geradoEm: string;
  }

  export interface GerarRelatorioInput {
    tipo: TipoRelatorio;
    periodoInicio: string;
    periodoFim: string;
  }

  function gerarRelatorio(input: GerarRelatorioInput): Promise<RelatorioGerado>
  function listarRelatorios(): Promise<RelatorioGerado[]>
  function baixarRelatorioBlob(id: string): Promise<Blob>

  function useRelatorios(): {
    relatorios: RelatorioGerado[];
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
  }
  ```
  Consumido pela Task 8 (tela `relatorios.tsx`).

- [ ] **Step 1: Adicionar `apiGetBlob` em `api.ts`**

Modificar `frontend/src/lib/api.ts`, adicionando ao final do arquivo:

```ts
export async function apiGetBlob(path: string): Promise<Blob> {
  const headers = new Headers();
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, { method: 'GET', headers });

  if (!response.ok) {
    throw new ApiError(
      `GET ${path} failed with status ${response.status}`,
      response.status,
    );
  }

  return response.blob();
}
```

- [ ] **Step 2: Criar `relatorios-api.ts`**

```ts
// frontend/src/lib/relatorios-api.ts
import { apiGet, apiGetBlob, apiPost } from '@/lib/api';

export type TipoRelatorio = 'MENSAL' | 'BIMESTRAL' | 'SEMESTRAL' | 'ANUAL';

export interface RelatorioGerado {
  id: string;
  tipo: TipoRelatorio;
  periodoInicio: string;
  periodoFim: string;
  arquivoPdfUrl: string;
  geradoEm: string;
}

export interface GerarRelatorioInput {
  tipo: TipoRelatorio;
  periodoInicio: string;
  periodoFim: string;
}

export function gerarRelatorio(
  input: GerarRelatorioInput,
): Promise<RelatorioGerado> {
  return apiPost<RelatorioGerado>('/relatorios', input);
}

export function listarRelatorios(): Promise<RelatorioGerado[]> {
  return apiGet<RelatorioGerado[]>('/relatorios');
}

export function baixarRelatorioBlob(id: string): Promise<Blob> {
  return apiGetBlob(`/relatorios/${id}/arquivo`);
}
```

- [ ] **Step 3: Criar `use-relatorios.ts`**

```ts
// frontend/src/hooks/use-relatorios.ts
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { listarRelatorios, type RelatorioGerado } from '@/lib/relatorios-api';

interface UseRelatoriosResult {
  relatorios: RelatorioGerado[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useRelatorios(): UseRelatoriosResult {
  const [relatorios, setRelatorios] = useState<RelatorioGerado[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);

  const fetchRelatorios = useCallback(async (): Promise<void> => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listarRelatorios();
      if (requestIdRef.current === requestId) {
        setRelatorios(result);
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
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchRelatorios();
    }, [fetchRelatorios]),
  );

  return { relatorios, isLoading, error, refetch: fetchRelatorios };
}
```

- [ ] **Step 4: Verificar tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/lib/relatorios-api.ts frontend/src/hooks/use-relatorios.ts
git commit -m "feat: adiciona client HTTP e hook de relatórios no frontend"
```

---

### Task 8: Tela de Relatórios + nova aba

**Files:**
- Create: `frontend/src/app/(app)/(tabs)/relatorios.tsx`
- Modify: `frontend/src/components/app-tabs.tsx`
- Modify: `frontend/src/components/app-tabs.web.tsx`

**Interfaces:**
- Consumes: `useRelatorios` (Task 7), `gerarRelatorio`/`baixarRelatorioBlob` (Task 7), `Colors.accent`/`accentSoft` (Task 6), `ThemedText`, `ThemedView`, `Spacing`, `BottomTabInset` (existentes).

Esta é a única tela do plano sem TDD unitário — é composição de UI que depende de módulos nativos (`expo-sharing`, `Platform.OS`) melhor validados manualmente do app rodando, seguindo o padrão das outras telas do projeto (`(tabs)/index.tsx`, `(tabs)/carne-leao.tsx` não têm testes de componente).

- [ ] **Step 1: Criar a tela**

```tsx
// frontend/src/app/(app)/(tabs)/relatorios.tsx
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRelatorios } from '@/hooks/use-relatorios';
import {
  baixarRelatorioBlob,
  gerarRelatorio,
  type RelatorioGerado,
  type TipoRelatorio,
} from '@/lib/relatorios-api';
import { BottomTabInset, Spacing } from '@/constants/theme';

const TIPOS: { valor: TipoRelatorio; label: string }[] = [
  { valor: 'MENSAL', label: 'Mensal' },
  { valor: 'BIMESTRAL', label: 'Bimestral' },
  { valor: 'SEMESTRAL', label: 'Semestral' },
  { valor: 'ANUAL', label: 'Anual' },
];

function calcularPeriodo(
  tipo: TipoRelatorio,
  ano: number,
  mes: number,
): { periodoInicio: string; periodoFim: string } {
  const duracaoMeses = { MENSAL: 1, BIMESTRAL: 2, SEMESTRAL: 6, ANUAL: 12 }[tipo];
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes - 1 + duracaoMeses, 1));
  return {
    periodoInicio: inicio.toISOString().slice(0, 10),
    periodoFim: fim.toISOString().slice(0, 10),
  };
}

function formatPeriodo(relatorio: RelatorioGerado): string {
  const inicio = relatorio.periodoInicio.slice(0, 10);
  const fim = new Date(relatorio.periodoFim);
  fim.setUTCDate(fim.getUTCDate() - 1);
  return `${inicio} a ${fim.toISOString().slice(0, 10)}`;
}

async function salvarEcompartilhar(id: string, nomeArquivo: string): Promise<void> {
  const blob = await baixarRelatorioBlob(id);

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  const caminho = `${FileSystem.cacheDirectory}${nomeArquivo}`;
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  await FileSystem.writeAsStringAsync(caminho, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(caminho);
}

export default function RelatoriosScreen() {
  const hoje = new Date();
  const [tipo, setTipo] = useState<TipoRelatorio>('MENSAL');
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [isGenerating, setIsGenerating] = useState(false);
  const { relatorios, isLoading, error, refetch } = useRelatorios();

  const gerar = async () => {
    setIsGenerating(true);
    try {
      const { periodoInicio, periodoFim } = calcularPeriodo(tipo, ano, mes);
      const relatorio = await gerarRelatorio({ tipo, periodoInicio, periodoFim });
      await refetch();
      await salvarEcompartilhar(relatorio.id, `relatorio-${relatorio.id}.pdf`);
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o relatório.');
    } finally {
      setIsGenerating(false);
    }
  };

  const baixarNovamente = async (relatorio: RelatorioGerado) => {
    try {
      await salvarEcompartilhar(relatorio.id, `relatorio-${relatorio.id}.pdf`);
    } catch {
      Alert.alert('Erro', 'Não foi possível baixar o relatório.');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Relatórios</ThemedText>

        <ThemedView style={styles.tiposRow}>
          {TIPOS.map((item) => (
            <Pressable key={item.valor} onPress={() => setTipo(item.valor)}>
              <ThemedView
                type={tipo === item.valor ? 'accentSoft' : 'backgroundElement'}
                style={styles.tipoChip}>
                <ThemedText
                  type="small"
                  themeColor={tipo === item.valor ? 'accent' : 'textSecondary'}>
                  {item.label}
                </ThemedText>
              </ThemedView>
            </Pressable>
          ))}
        </ThemedView>

        <ThemedView style={styles.periodoRow}>
          <Pressable onPress={() => (mes === 1 ? (setAno(ano - 1), setMes(12)) : setMes(mes - 1))}>
            <ThemedText type="smallBold">◀</ThemedText>
          </Pressable>
          <ThemedText type="default">
            {mes}/{ano}
          </ThemedText>
          <Pressable onPress={() => (mes === 12 ? (setAno(ano + 1), setMes(1)) : setMes(mes + 1))}>
            <ThemedText type="smallBold">▶</ThemedText>
          </Pressable>
        </ThemedView>

        <Pressable onPress={gerar} disabled={isGenerating} style={styles.gerarBotao}>
          <ThemedText type="smallBold" themeColor="background">
            {isGenerating ? 'Gerando...' : 'Gerar relatório'}
          </ThemedText>
        </Pressable>

        {isLoading && <ThemedText type="small">carregando histórico...</ThemedText>}
        {error && (
          <ThemedText themeColor="textSecondary">
            erro ao carregar histórico: {error.message}
          </ThemedText>
        )}

        {relatorios.map((relatorio) => (
          <Pressable key={relatorio.id} onPress={() => baixarNovamente(relatorio)}>
            <ThemedView type="accentSoft" style={styles.historicoItem}>
              <ThemedText type="smallBold">{relatorio.tipo}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatPeriodo(relatorio)}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ))}
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
  tiposRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tipoChip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
  },
  periodoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
  },
  gerarBotao: {
    backgroundColor: '#7C3AED',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  historicoItem: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.half,
  },
});
```

Nota: `gerarBotao` usa `#7C3AED` fixo (cor light do `accent`) em vez de `useTheme()` — ajustar para tema dinâmico: importar `useTheme` de `@/hooks/use-theme` e trocar `backgroundColor: '#7C3AED'` por um `style` inline `{ backgroundColor: theme.accent }` no componente, junto com `const theme = useTheme();` no topo da função.

- [ ] **Step 2: Adicionar a aba nativa**

Modificar `frontend/src/components/app-tabs.tsx`, adicionando após o trigger `empresa`:

```tsx
<NativeTabs.Trigger name="relatorios">
  <NativeTabs.Trigger.Label>Relatórios</NativeTabs.Trigger.Label>
  <NativeTabs.Trigger.Icon sf="doc.text" md="description" />
</NativeTabs.Trigger>
```

- [ ] **Step 3: Adicionar a aba web**

Modificar `frontend/src/components/app-tabs.web.tsx`, adicionando após o `TabTrigger` de `empresa`:

```tsx
<TabTrigger name="relatorios" href="/relatorios" asChild>
  <TabButton>Relatórios</TabButton>
</TabTrigger>
```

- [ ] **Step 4: Verificar tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Rodar o app na web e verificar manualmente**

Run: `cd frontend && npm run web` (ou `npx expo start --web`)

Verificar no navegador:
- Aba "Relatórios" aparece e navega corretamente.
- Selecionar tipo + período, clicar "Gerar relatório" — deve baixar um PDF.
- Abrir o PDF baixado e confirmar que mostra os totais e a tabela por categoria (ou "nenhuma transação" se período vazio).
- Histórico lista o relatório recém-gerado; clicar nele baixa de novo.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/\(app\)/\(tabs\)/relatorios.tsx frontend/src/components/app-tabs.tsx frontend/src/components/app-tabs.web.tsx
git commit -m "feat: adiciona tela de Relatórios com geração e histórico de PDF"
```

---

### Task 9: Migração do schema (se necessário) e verificação final

**Files:**
- Nenhum arquivo novo — apenas verificação.

**Interfaces:** N/A.

- [ ] **Step 1: Confirmar que `RelatorioGerado` já está migrado**

Run: `cd backend && npx prisma migrate status`
Expected: nenhuma migração pendente relacionada a `RelatorioGerado` (o modelo já existe no schema desde antes deste plano). Se houver drift, rodar `npx prisma migrate dev --name relatorio_gerado` para sincronizar.

- [ ] **Step 2: Rodar a suíte completa do backend**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 3: Rodar o CI localmente (lint + typecheck)**

Run: `cd backend && npm run lint`
Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros em ambos.

- [ ] **Step 4: Commit final (se houver migração pendente aplicada)**

```bash
git add backend/prisma/migrations
git commit -m "chore: sincroniza migração do RelatorioGerado" --allow-empty
```

(Só criar este commit se o Step 1 gerou uma migração nova; caso contrário, pular.)

---

## Fora de escopo (repetido da spec)

- Documentos Fiscais e Bens e Direitos.
- Conteúdo de PJ/carnê-leão dentro do relatório.
- Extensão da paleta `accent` para o restante do app.
