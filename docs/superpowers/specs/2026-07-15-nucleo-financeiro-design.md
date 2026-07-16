# Design: Núcleo Financeiro (Transações + Categorias)

Data: 2026-07-15

## Contexto

Com autenticação e onboarding de workspace já implementados e mergeados, o
`(app)` ainda é o boilerplate padrão do Expo — nenhuma funcionalidade
financeira real existe. Este design cobre o registro do dia a dia (lançar,
listar, editar e excluir receitas/despesas) usando os models `Transacao` e
`Categoria`, que já existem em `backend/prisma/schema.prisma` — nenhuma
migration nova é necessária. Não cobre dashboard/gráficos, categorias
personalizadas pelo usuário, múltiplas contas bancárias, orçamento mensal,
nem geração de relatórios em PDF — tudo isso fica para etapas futuras (ver
"Fora de escopo").

## Decisões

- **Escopo desta etapa: CRUD completo de transações + listagem de
  categorias do sistema.** Sem dashboard/gráficos ainda — só o registro
  funcionando bem primeiro.
- **Qualquer membro do workspace pode editar/excluir qualquer transação do
  workspace.** Reflete o uso real (corrigir um lançamento errado do
  parceiro) e a natureza compartilhada da carteira — não é restrito a quem
  registrou (`usuarioId` continua sendo gravado e preservado, só não limita
  quem pode alterar depois).
- **Categorias: só as do sistema por enquanto, sem CRUD de categoria
  própria.** Seed fixo de 10 categorias (`sistema: true`), mesmo padrão de
  auto-seed usado para `Plano` no onboarding (checa `count()` antes de
  popular, roda uma vez). Criar categoria própria do workspace fica para
  uma etapa futura pequena.
- **Lista das 10 categorias padrão:**
  - Receita: `Salário`, `Renda Extra`
  - Despesa: `Alimentação`, `Transporte`, `Moradia`, `Saúde`, `Lazer`,
    `Educação`, `Compras`, `Outros`
- **Listagem por mês, com navegação entre meses.** A tela mostra o mês
  atual por padrão, com navegação pra mês anterior/próximo — reflete como
  as pessoas pensam sobre finanças ("quanto gastei esse mês") e mantém a
  resposta da API pequena (sem paginação nesta etapa).
- **`valor` sempre armazenado como magnitude positiva.** O sinal
  (receita/despesa) é derivado do campo `tipo` (`TransacaoTipo`), nunca do
  sinal do próprio `valor` — evita ambiguidade se algum dia divergirem.
- **Nova peça de infraestrutura reutilizável: `WorkspaceGuard` +
  `@CurrentWorkspace()`.** Toda operação de `Transacao` precisa saber a
  qual workspace o usuário pertence. Em vez de resolver isso inline em cada
  método do `TransacaoService` (duplicando a chamada a
  `WorkspaceService.findMine`), um guard novo resolve o workspace do
  usuário autenticado e anexa ao request, com um decorator para extrair no
  controller — mesmo padrão já estabelecido por `JwtAuthGuard`/
  `CurrentUser`. Reutilizável por qualquer módulo financeiro futuro
  (relatórios, carnê-leão, DAS) que também precise de escopo por workspace.
  Se o usuário autenticado não tiver workspace (não deveria acontecer, já
  que o onboarding é obrigatório, mas é a defesa correta), o guard bloqueia
  com `403`.

## Arquitetura (backend)

Dois módulos novos + uma peça de infraestrutura compartilhada:

```
backend/src/workspace/
├── guards/
│   └── workspace.guard.ts        # resolve o workspace do usuário, anexa ao request
└── decorators/
    └── current-workspace.decorator.ts   # @CurrentWorkspace()

backend/src/categoria/
├── categoria.module.ts
├── categoria.controller.ts       # GET /categorias
└── categoria.service.ts          # auto-seed + listagem

backend/src/transacao/
├── transacao.module.ts
├── transacao.controller.ts       # POST/GET/PATCH/DELETE /transacoes
├── transacao.service.ts
└── dto/
    ├── create-transacao.dto.ts
    └── update-transacao.dto.ts
```

Todas as rotas de `TransacaoController` protegidas por
`@UseGuards(JwtAuthGuard, WorkspaceGuard)`. `CategoriaController` só precisa
de `JwtAuthGuard` (a lista de categorias do sistema não é específica de
workspace).

## Endpoints e regras

### `GET /categorias`
- Roda o auto-seed (se a tabela estiver vazia) e retorna todas as
  categorias com `sistema: true`, ordenadas por `nome`.
- Retorno: `{ id, nome, cor, icone }[]`.

### `POST /transacoes`
```ts
class CreateTransacaoDto {
  @IsEnum(TransacaoTipo)
  tipo: TransacaoTipo; // 'RECEITA' | 'DESPESA'

  @IsNumber()
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
- `usuarioId` sempre vem do `CurrentUser` (nunca do body) — identifica quem
  registrou, mas não restringe quem pode editar depois.
- `workspaceId` vem do `CurrentWorkspace` (nunca do body).
- Se `categoriaId` for enviado, valida que a categoria existe — `400` se
  não existir.
- Retorna a transação criada (com categoria populada, se houver).

### `GET /transacoes?ano=2026&mes=7`
- Lista as transações do workspace atual, filtradas por `data` dentro do
  mês/ano informado, ordenadas por `data` desc.
- `ano`/`mes` obrigatórios (o frontend sempre envia o mês em foco).
- Retorna `{ id, tipo, valor, categoria, descricao, data, usuarioId }[]`.

### `PATCH /transacoes/:id`
- Mesmos campos do create, todos opcionais (`update-transacao.dto.ts` —
  partial).
- Verifica que a transação pertence ao workspace do usuário atual (via
  `WorkspaceGuard`) — `404` se não pertencer (não vaza que a transação
  existe em outro workspace).
- Qualquer membro do workspace pode editar (não restrito a quem criou).

### `DELETE /transacoes/:id`
- Mesma checagem de pertencimento ao workspace do `PATCH`.
- `204` No Content ao excluir.

## Frontend (Expo / expo-router)

```
frontend/src/
├── hooks/
│   └── use-transacoes.ts    # fetch por mês, create/update/delete
└── app/
    └── (app)/
        ├── index.tsx              # lista do mês + navegação de mês
        └── nova-transacao.tsx     # formulário de criar/editar (rota separada)
```

**`useTransacoes(ano, mes)`**: hook local à tela (não é um Context global —
diferente de `AuthContext`/`WorkspaceContext`, não precisa ser lido por
múltiplas telas ainda). Busca `GET /transacoes?ano=&mes=` quando `ano`/`mes`
mudam. Expõe `{ transacoes, isLoading, error, createTransacao,
updateTransacao, deleteTransacao }`.

**`(app)/index.tsx`** (substitui o boilerplate atual do Expo): topo com
navegação de mês (◀ Julho 2026 ▶), lista de transações do mês (data,
descrição, categoria, valor colorido por tipo — verde receita / vermelho
despesa), botão flutuante "+" que navega para `nova-transacao`.

**`(app)/nova-transacao.tsx`**: rota separada (não modal), reaproveitada
tanto para criar quanto para editar (recebe um `id` opcional via param de
rota). Formulário: tipo (toggle Receita/Despesa), valor, categoria (select
das categorias do sistema, buscadas via `GET /categorias`), data (default
hoje), descrição opcional. Erros aparecem inline, mesmo padrão dos
formulários de auth/onboarding (`ApiError` + `err.message`).

**Edição/exclusão**: tap numa transação da lista navega para
`nova-transacao` com os campos preenchidos (edição). Exclusão via swipe ou
long-press na lista, com confirmação nativa simples (sem modal customizado
de "tem certeza").

## Erros e testes

**Erros:** `401` sem token (já existente); `403` autenticado mas sem
workspace (via `WorkspaceGuard` — defesa, não deve ocorrer na prática já
que onboarding é obrigatório); `400` DTO inválido (`valor` ausente/negativo,
`tipo` fora do enum, `categoriaId` inexistente); `404` transação não
encontrada ou pertencente a outro workspace.

**Testes backend (Jest):**
- Unit `WorkspaceGuard`: anexa o workspace corretamente quando existe,
  lança `403` quando o usuário autenticado não tem workspace.
- Unit `CategoriaService`: seed roda só se a tabela estiver vazia
  (idempotente), lista retorna só `sistema: true`.
- Unit `TransacaoService`: create (com e sem `categoriaId`), list filtrado
  por mês/ano, update, delete, e o caso de tentar editar/excluir uma
  transação de outro workspace (deve falhar).
- E2E: fluxo completo criar → listar (filtrado por mês) → editar → excluir
  contra Postgres real, mesmo padrão de `workspace.e2e-spec.ts`.

**Testes frontend:** sem test runner configurado (mesma situação do módulo
de auth/onboarding) — verificação via `tsc --noEmit` + validação manual no
browser.

## Fora de escopo (explicitamente adiado)

- Dashboard/gráficos (total do mês, gasto por categoria, evolução).
- CRUD de categoria própria do workspace (só categorias do sistema por
  enquanto).
- Múltiplas contas bancárias por membro (carteira única do workspace,
  ponto em aberto do produto original).
- Orçamento mensal por categoria com alertas de estouro.
- Importação de extrato/CSV.
- Geração de relatórios em PDF (`RelatorioGerado`) — módulo separado,
  motor determinístico (Puppeteer/react-pdf), fora do escopo aqui.
- Paginação da listagem (o volume mensal de uma família é baixo o
  suficiente para não precisar agora).
