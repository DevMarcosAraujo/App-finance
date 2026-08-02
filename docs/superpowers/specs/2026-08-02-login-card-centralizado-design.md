# Login e Registro — Card Centralizado — Design

## Contexto

As telas de login e registro (`frontend/src/app/(auth)/login.tsx` e
`register.tsx`) hoje renderizam o formulário direto na tela toda, sem
nenhum agrupamento visual — inputs com borda cinza genérica
(`#8888`) e botão azul fixo (`#3c87f7`), sem usar a cor `accent`
(violeta) já adicionada ao design system em
`docs/superpowers/specs/2026-08-02-relatorios-e-identidade-visual-design.md`.

Este ciclo redesenha as duas telas para usar um card centralizado,
aplicando a cor `accent` — mesma direção visual já usada na tela de
Relatórios.

## 1. Layout do card centralizado

- Ambas as telas passam a renderizar um card
  (`ThemedView type="backgroundElement"`, cantos arredondados, padding
  interno) centralizado vertical e horizontalmente na tela.
- Nova constante `AuthCardMaxWidth` em `frontend/src/constants/theme.ts`
  (ao lado de `MaxContentWidth`), com valor `420`.
- Em telas estreitas (mobile), o card ocupa a largura disponível menos o
  padding lateral (`Spacing.four` de cada lado). Em telas largas (web), o
  card fica centralizado com `maxWidth: AuthCardMaxWidth`, sobrando espaço
  vazio nas laterais.
- Fora do card, o fundo da tela usa a cor `background` padrão do tema —
  sem gradiente, sem imagem de fundo.

## 2. Estilo interno do card e dos campos

- Título: usa `ThemedText type="subtitle"` (32px) em vez do `type="title"`
  atual (48px) — o tamanho atual é grande demais dentro de um card
  pequeno.
- Inputs: fundo `backgroundElement`, sem borda cinza genérica (remove
  `borderColor: '#8888'`), cantos arredondados (`Spacing.two`), padding
  interno (`Spacing.three`).
- Botão ("entrar" / "criar conta"): `backgroundColor` usa `theme.accent`
  (via `useTheme()`, dinâmico por light/dark — não hardcoded), texto em
  branco/`background` (mesmo padrão de contraste já usado no FAB da Home).
- Link abaixo do botão ("criar uma conta" / "já tenho conta"): mantém
  `ThemedText type="linkPrimary"`, centralizado.
- Mensagem de erro: passa de `themeColor="textSecondary"` para
  `themeColor="expense"` (vermelho já usado no app para valores
  negativos) — mais visível como estado de erro, sem introduzir uma cor
  nova.

## Fora de escopo

- Qualquer landing page ou menu de navegação antes do login (só o
  formulário existente é redesenhado).
- Mudança de campos ou de lógica de validação/submissão — só layout e
  cor.
- Extensão da cor `accent` para outras telas além de login/registro
  (Relatórios já usa, essas duas são as próximas).
