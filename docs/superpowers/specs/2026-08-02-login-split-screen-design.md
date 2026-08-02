# Login e Registro — Split-Screen Responsivo — Design

## Contexto

O ciclo anterior (`2026-08-02-login-card-centralizado-design.md`) redesenhou
login/registro com um card centralizado, aplicado uniformemente em qualquer
largura de tela. Este ciclo substitui esse comportamento em telas largas por
um layout split-screen (imagem/gradiente de um lado, formulário do outro),
inspirado em um mockup de referência fornecido pelo usuário — mantendo o
card centralizado como está hoje para mobile/telas estreitas, sem nenhuma
mudança lá.

## 1. Layout responsivo

Novo componente compartilhado `frontend/src/components/auth-split-layout.tsx`,
usado por `login.tsx` e `register.tsx`, que decide o layout via
`useWindowDimensions()`:

- **Largura ≥ 900px** (desktop/tablet largo): split-screen — painel
  esquerdo com gradiente ocupando ~50% da largura, painel direito com o
  formulário ocupando a outra metade (sem `maxWidth`/centralização
  própria — ocupa o painel inteiro).
- **Largura < 900px** (mobile, incluindo app nativo iOS/Android): mantém
  exatamente o comportamento já implementado no ciclo anterior — card
  centralizado com `AuthCardMaxWidth`, sem gradiente, sem texto de
  destaque. Nenhuma mudança visual no mobile nativo.

O breakpoint (900px) é uma constante nomeada (`AuthSplitBreakpoint`) em
`frontend/src/constants/theme.ts`, não um número mágico inline.

## 2. Conteúdo do painel esquerdo (só telas ≥ 900px)

- Gradiente usando `expo-linear-gradient` (nova dependência), de
  `theme.accent` para `theme.accentSoft`.
- Texto de destaque sobreposto, branco, mesmo texto em login e registro
  (não é informação funcional, só reforço de identidade): "Organize as
  finanças da família em um só lugar".
- Sem foto/imagem real, sem link de "esqueci a senha" (não existe fluxo de
  recuperação de senha no backend — fora de escopo).

## 3. Estrutura

- `AuthSplitLayout` recebe o formulário como `children` (o card com
  título/inputs/botão/link, que já existe hoje) e decide internamente se
  renderiza:
  - Split: `View` com `flexDirection: 'row'`, painel gradiente à esquerda
    (`flex: 1`) + painel do formulário à direita (`flex: 1`, formulário
    centralizado dentro dele, sem `maxWidth` do card já que ocupa a
    metade inteira).
  - Mobile: mesma estrutura já existente hoje (`SafeAreaView` +
    `justifyContent: 'center'` + card com `AuthCardMaxWidth`) — nenhuma
    mudança.
- `login.tsx`/`register.tsx` passam a envolver seu conteúdo com
  `AuthSplitLayout`, mas mantêm seus próprios `TextInput`s, estado e
  `handleSubmit` exatamente como estão — só a estrutura de layout externa
  muda.

## Fora de escopo

- Link "esqueci a senha" (sem fluxo de recuperação de senha implementado).
- Foto/imagem real (usa gradiente de cor, não asset de imagem).
- Textos de destaque diferentes por tela (mesmo texto em login/registro).
- Mudança de campos, validação ou lógica de submissão.
