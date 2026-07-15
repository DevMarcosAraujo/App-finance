# Design: Onboarding de Workspace

Data: 2026-07-15

## Contexto

Depois do login/registro (módulo de autenticação, já implementado e mergeado
em `main`), o usuário ainda não pertence a nenhum `Workspace`. Este design
cobre o fluxo que cria o primeiro workspace do usuário — não cobre convite
de membro por email, múltiplas contas bancárias por membro, nem cobrança
real dos planos (tudo isso fica para etapas futuras, ver "Fora de escopo").

## Decisões

- **Onboarding é obrigatório antes do `(app)`.** Se o usuário está
  autenticado mas não pertence a nenhum `WorkspaceMembro`, ele só consegue
  ver as telas de onboarding — igual ao gate que já existe entre `(auth)` e
  `(app)`.
- **Arquitetura em módulo separado.** Novo `WorkspaceModule` no backend
  (`POST /workspaces`, `GET /workspaces/me`) e um `WorkspaceContext` novo no
  frontend, independente do `AuthContext`/`AuthModule` — replica o padrão
  que já funcionou no módulo de autenticação, mantendo identidade
  (`Usuario`) e associação a workspace como conceitos separados (como já
  são no schema).
- **Auto-seed de `Plano`.** A tabela `Plano` está vazia hoje (sem script de
  seed). Em vez de exigir um passo manual, o backend cria os dois planos
  padrão (`INDIVIDUAL` e `FAMILIA`) automaticamente na primeira vez que
  alguém precisar de um, com preços placeholder (`precoBase: 0` — sem
  cobrança real nesta fase de uso pessoal). Os valores continuam vivendo na
  tabela `Plano` depois disso (editáveis via admin no futuro), não
  hardcoded na lógica de negócio.
- **Nome do workspace é automático.** `"Financeiro de {primeiro nome}"` —
  sem campo de texto na tela, sem fricção extra. Renomear fica para uma
  configuração futura.
- **Sem preço na tela.** A escolha é só entre "Individual" e "Família /
  Casal", com descrição funcional (quantos membros, etc.), sem valores em
  R$ — não há cobrança real ainda.
- **Convite de membro por email fica para depois.** Esta etapa só cria o
  workspace com o criador como `DONO`. O mecanismo de convidar outra pessoa
  (a esposa, por exemplo) é uma etapa separada.
- **Pontos em aberto da spec original do produto** (limite de membros fixo
  vs. escalável no plano família; contas bancárias separadas por membro vs.
  carteira única) continuam em aberto — não são decididos nem hardcoded
  aqui.

## Arquitetura (backend)

Novo `WorkspaceModule` em `backend/src/workspace/`:

```
backend/src/workspace/
├── workspace.module.ts
├── workspace.controller.ts   # POST /workspaces, GET /workspaces/me
├── workspace.service.ts      # auto-seed de Plano, criação de Workspace+WorkspaceMembro
└── dto/
    └── create-workspace.dto.ts   # { tipo: PlanoTipo }
```

Ambas as rotas protegidas por `JwtAuthGuard` (reaproveitado do
`AuthModule`, já exportado de lá — sem duplicar guard/strategy).

## Endpoints e regras

### `POST /workspaces`
```ts
class CreateWorkspaceDto {
  @IsEnum(PlanoTipo)
  tipo: PlanoTipo; // 'INDIVIDUAL' | 'FAMILIA'
}
```
- Se o usuário autenticado **já** pertence a algum `WorkspaceMembro` →
  `409 Conflict` ("usuário já pertence a um workspace").
- **Auto-seed:** se não existir nenhum `Plano` no banco, cria os dois de
  uma vez (`INDIVIDUAL` e `FAMILIA`) com `precoBase: 0`,
  `precoPorMembro: null` (individual) / `0` (família),
  `limiteMembros: 1` (individual) / `null` (família — ponto em aberto, não
  decidido).
- Cria `Workspace` (`nome` auto-gerado, `planoId` do plano do `tipo`
  escolhido) + `WorkspaceMembro` (`role: DONO`).
- Retorna `{ id, nome, plano: { tipo } }`.

### `GET /workspaces/me`
- Busca o `WorkspaceMembro` do usuário atual (join com `Workspace`/`Plano`).
- `200` com `{ id, nome, plano: { tipo } }` se existir.
- `404 Not Found` se não existir — o frontend trata isso como "precisa de
  onboarding", não como erro real.

## Frontend (Expo / expo-router)

```
frontend/src/
├── contexts/
│   └── workspace-context.tsx   # WorkspaceProvider, useWorkspace()
└── app/
    └── (onboarding)/
        ├── _layout.tsx
        └── index.tsx            # escolher Individual ou Família/Casal
```

**`WorkspaceContext`** fica aninhado dentro do `AuthProvider` (depende de
estar autenticado). Assim que `useAuth().usuario` deixa de ser `null`,
dispara `GET /workspaces/me`: `404` → `workspace = null` (estado normal);
`200` → `workspace` preenchido. Expõe `{ workspace, isLoading,
createWorkspace(tipo) }`. `createWorkspace` chama `POST /workspaces` e
atualiza o `workspace` no contexto — o layout raiz reage sozinho e navega
pro `(app)`, sem redirect manual na tela.

**Gating de três estados no `_layout.tsx` raiz** (estende o
`Stack.Protected` que já existe do módulo de auth):
- `isLoading` (auth) → nada renderizado.
- sem `usuario` → só `(auth)`.
- `usuario` mas `workspace` ainda carregando → nada renderizado.
- `usuario` sem `workspace` → só `(onboarding)`.
- `usuario` com `workspace` → só `(app)`.

**Tela `(onboarding)/index.tsx`:** dois cartões/botões — "Individual" e
"Família / Casal" — com frase curta do que significa, sem preço. Ao
escolher, chama `createWorkspace(tipo)`; erro (ex: já tem workspace)
aparece como mensagem simples na tela, no mesmo padrão do login/registro.

## Erros e testes

**Erros:** `401` sem token; `400` DTO inválido (`tipo` fora do enum);
`409` se o usuário já tiver workspace.

**Testes backend (Jest):**
- Unit (`WorkspaceService`): auto-seed de `Plano` (cria só se não existir),
  criação de `Workspace`+`WorkspaceMembro` com `role: DONO`, rejeição
  `409` se o usuário já tiver workspace, geração do nome automático.
- E2E: fluxo completo register → `POST /workspaces` → `GET /workspaces/me`
  retorna o mesmo workspace; segunda chamada a `POST /workspaces` retorna
  `409`.

**Testes frontend:** sem test runner configurado (mesma situação do módulo
de auth) — validação manual rodando o app.

## Fora de escopo (explicitamente adiado)

- Convite de membro por email no plano Família/Casal.
- Múltiplas contas bancárias por membro vs. carteira única (ponto em
  aberto do produto, não decidido).
- Limite de membros fixo vs. escalável no plano família (ponto em aberto).
- Cobrança/pagamento real dos planos.
- Renomear o workspace depois de criado.
- Promover conta individual para compartilhada (mencionado na spec do
  produto, mas não implementado aqui).
