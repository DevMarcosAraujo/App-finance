# Relatórios (PDF) + Identidade Visual — Design

## Contexto

O app já tem núcleo financeiro, carnê-leão e módulo PJ implementados e em
produção (uso pessoal Marcos + esposa). O roadmap aponta relatórios PDF e
documentos fiscais/bens como próximos passos. Este ciclo cobre:

1. Uma identidade visual própria (o tema atual é o padrão do template Expo).
2. O módulo de Relatórios (mensal/bimestral/semestral/anual), full-stack —
   hoje só existe o modelo `RelatorioGerado` no schema, sem nenhum backend.

Documentos Fiscais e Bens e Direitos ficam para um ciclo futuro (fora de
escopo aqui).

## 1. Identidade visual

Direção: "vibrante e moderno", estilo fintech atual.

- Mantém os fundos neutros (light/dark) já existentes em
  `frontend/src/constants/theme.ts` e as cores semânticas `income`/`expense`
  (já funcionam bem e são usadas em várias telas).
- Adiciona uma cor de destaque única (`accent`) para botões primários, FAB,
  estados ativos/links: violeta `#7C3AED` (light) / `#A78BFA` (dark).
- Adiciona `accentSoft` — versão translúcida de `accent` — para fundos de
  card/badge que precisem de destaque sutil sem competir com o texto.
- Tipografia permanece `Spline Sans/Inter` (já configurada via
  `--font-display` em `global.css`); passa a ser usada com mais intenção de
  hierarquia (pesos diferentes, não só tamanho).
- Sem novas dependências de estilo — continua `StyleSheet` +
  `ThemedText`/`ThemedView`, sem introduzir Tailwind/NativeWind.
- A tela de Relatórios (seção 3) é a primeira a aplicar a paleta nova,
  servindo de referência para estender ao resto do app depois.

## 2. Backend — módulo Relatório

Novo `backend/src/relatorio/`, seguindo o padrão dos módulos existentes
(`transacao/`, `carne-leao/`): controller + service + dto + `.spec.ts` +
`relatorio.module.ts`, registrado em `AppModule`.

### Agregação

`RelatorioService.gerar(workspaceId, tipo, periodoInicio, periodoFim)`:

- Busca `Transacao` do workspace no intervalo de datas.
- Agrega: total de receitas, total de despesas, saldo, e subtotal por
  `Categoria`.
- Não há regra fiscal envolvida — é soma direta de dados que já existem, então
  nenhum `Parametro*` versionado entra aqui (não viola o princípio de
  hardcode fiscal porque não há cálculo fiscal neste módulo).
- Se não houver transações no período, retorna agregação vazia (o front
  trata como estado vazio, não como erro).

### Geração de PDF

- Novo componente `relatorio.pdf.tsx` usando `@react-pdf/renderer` (nova
  dependência no backend). Recebe os dados já agregados (puro, sem I/O),
  renderiza: cabeçalho com tipo + período, tabela de totais por categoria,
  totais gerais (receita/despesa/saldo).
- `RelatorioService` chama esse componente, obtém o buffer do PDF.

### Storage

- Buffer salvo em disco local: `backend/storage/relatorios/{workspaceId}/{relatorioId}.pdf`.
  Pasta fora de `src/`, adicionada ao `.gitignore` (é conteúdo gerado, não
  código).
- Cria o diretório do workspace se não existir.
- Registro `RelatorioGerado` (schema já existe) é criado com
  `arquivoPdfUrl` apontando para a rota de download própria (não para o
  path de disco diretamente): `/relatorios/:id/arquivo`.

### Rotas (`RelatorioController`)

Todas atrás do `JwtAuthGuard` existente, resolvendo `workspaceId` a partir
do usuário autenticado (mesmo padrão dos outros controllers):

- `POST /relatorios` — body `{ tipo, periodoInicio, periodoFim }` → gera
  arquivo + registro, retorna metadata do `RelatorioGerado` (sem o binário).
- `GET /relatorios` — lista relatórios já gerados do workspace (histórico),
  mais recentes primeiro.
- `GET /relatorios/:id/arquivo` — stream do PDF; 404 se o relatório não
  pertence ao workspace do usuário autenticado.

## 3. Frontend — tela de Relatórios

### Navegação

Nova aba "Relatórios" em `frontend/src/app/(app)/(tabs)/_layout.tsx`, ao
lado de Home / Carnê-Leão / Empresa. Nova tela
`frontend/src/app/(app)/(tabs)/relatorios.tsx`.

### Fluxo

- Seletor de tipo (Mensal/Bimestral/Semestral/Anual) + navegação de
  período, reaproveitando o padrão de mês/ano já usado na Home
  (`(tabs)/index.tsx`) — adaptado para os períodos maiores quando
  bimestral/semestral/anual.
- Botão "Gerar relatório" (cor `accent`) → `POST /relatorios`, mostra
  loading, e ao concluir baixa o PDF automaticamente:
  - Mobile: `expo-sharing` abre o menu nativo de compartilhar/salvar.
  - Web: download via `<a download>`.
- Abaixo, lista de histórico (`GET /relatorios`): cada item mostra tipo +
  período + botão "baixar novamente" (reusa `GET /relatorios/:id/arquivo`).
  Cards usam `accentSoft` como destaque sutil de fundo.

### Camada de dados

- `frontend/src/lib/relatorios-api.ts` — client HTTP, mesmo padrão de
  `transacoes-api.ts` (funções `gerarRelatorio`, `listarRelatorios`,
  `baixarRelatorio`).
- `frontend/src/hooks/use-relatorios.ts` — hook de listagem, espelhando
  `use-transacoes.ts` (estado de loading/error/refetch).

## 4. Erros e estados vazios

- Período sem transações: a agregação retorna vazia, o backend ainda gera
  o PDF (relatório "zerado") — não é tratado como erro. O frontend mostra
  o resultado normalmente (totais em zero).
- Falha real de geração (ex: erro de I/O ao salvar o arquivo): backend
  retorna erro, frontend mostra mensagem "não foi possível gerar o
  relatório" sem quebrar a tela, mantendo o histórico existente visível.

## 5. Testes

- `RelatorioService`: agregação de transações por categoria/tipo, e
  comportamento com período vazio.
- `RelatorioController`: guards de autenticação, isolamento por
  workspace (usuário não acessa relatório de outro workspace).
- Sem teste de renderização de PDF pixel-a-pixel — apenas que o buffer é
  gerado sem lançar erro para um conjunto de dados de exemplo.

## Fora de escopo

- Documentos Fiscais e Bens e Direitos (próximo ciclo).
- Conteúdo de PJ/carnê-leão dentro do relatório (só core financeiro nesta
  primeira versão).
- Extensão da nova paleta visual para o restante do app além da tela de
  Relatórios (fica como referência para ciclos futuros).
