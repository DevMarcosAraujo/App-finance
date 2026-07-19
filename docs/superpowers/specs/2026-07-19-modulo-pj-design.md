# Design: Módulo PJ (MEI/ME)

Data: 2026-07-19

## Contexto

Com o carnê-leão completo e mesclado, este design cobre o **módulo PJ** —
cadastro de empresa, faturamento mensal, apuração do DAS (MEI e Simples
Nacional), pró-labore, distribuição de lucros e acompanhamento do limite
anual do MEI. Os models já existem em `backend/prisma/schema.prisma`:
`Empresa`, `FaturamentoMensalPJ`, `RBT12Cache`, `DASApuracao`, `ProLabore`,
`DistribuicaoLucros`, `AcompanhamentoLimiteMEI`, `ParametroFiscalPJ`,
`AnexoSimplesTabela` — nenhuma migration nova é necessária.

Contexto de negócio (não regra do sistema): Marcos hoje só tem CPF e
planeja abrir MEI; a esposa já tem CNPJ ME (Simples Nacional) em operação.
O módulo precisa suportar os dois regimes desde o início, não só um deles.

Mesmo princípio do carnê-leão: **todos esses models são vinculados a
`usuarioId`** (sócio/titular do CNPJ), nunca a `workspaceId` — cada empresa
pertence a uma pessoa física específica, mesmo numa conta compartilhada.
Nenhuma rota deste módulo usa `WorkspaceGuard`.

Não cobre: seleção de múltiplas empresas por usuário na UI (schema
suporta, telas assumem a primeira empresa ativa), abertura/baixa de CNPJ
junto à Receita, emissão de nota fiscal, integração com o PGDAS-D ou
geração do boleto/DARF real, calendário de feriados para vencimento exato,
ligação com a declaração anual de IR — ver "Fora de escopo".

## Decisões

- **Escopo completo nesta etapa**: CRUD de empresa, CRUD de faturamento
  mensal, cálculo de RBT12 (Simples), apuração automática do DAS (MEI e
  Simples), CRUD de pró-labore com INSS/IRRF calculados, CRUD de
  distribuição de lucros com isenção calculada, acompanhamento do limite
  anual do MEI, e telas mobile completas para tudo isso.
- **`ParametroFiscalPJ` e `AnexoSimplesTabela` populados via auto-seed no
  boot**, mesmo padrão do carnê-leão (`ensureSeed`/`onModuleInit`). Os
  valores oficiais de 2026 são fornecidos pelo usuário do sistema (não
  inventados pelo agente que implementa este design) — ver "Valores do
  seed" abaixo.
- **`DASApuracaoService` único, com branch interno por regime** — mesmo
  padrão do `ApuracaoCarneLeaoService`, que já trata múltiplos casos
  (isento/incerto/normal) numa função só. MEI e Simples não justificam
  services separados nem um strategy pattern — são duas ramificações de
  uma mesma responsabilidade.
- **Recálculo em cascata a partir do faturamento**: toda vez que um
  `FaturamentoMensalPJ` é criado, atualizado ou excluído, dispara em
  sequência: `RBT12Service` (recalcula `RBT12Cache` daquela competência,
  só se regime = SIMPLES_ME) → `DASApuracaoService` (recalcula
  `DASApuracao` daquela competência) → `AcompanhamentoLimiteMeiService`
  (recalcula `AcompanhamentoLimiteMEI` daquele ano-calendário, só se
  regime = MEI). Mesmo espírito do `recalcular()` do carnê-leão: sempre
  recalcula do zero a partir dos dados atuais, nunca incrementalmente —
  evita drift por edição/exclusão de lançamento antigo.
- **RBT12 proporcional para empresa nova**: se a empresa tem menos de 12
  meses de atividade (contando de `dataAbertura`), o RBT12 usado no
  cálculo do DAS é `(soma do faturamento desde a abertura ÷ meses de
  atividade) × 12` — regra oficial do Simples Nacional para empresas em
  início de atividade, não uma aproximação do sistema.
- **DAS do MEI é sempre o valor fixo tabelado** por `ParametroFiscalPJ`,
  conforme `Empresa.atividadeTipo` (`COMERCIO`/`INDUSTRIA` →
  `meiDasComercioIndustria`, `SERVICO` → `meiDasServicos`,
  `COMERCIO_SERVICO` → `meiDasComercioServicos`). Não depende de RBT12 nem
  de faturamento do mês.
- **DAS do Simples usa a fórmula oficial de alíquota efetiva**: a faixa de
  `AnexoSimplesTabela` (filtrada por `anexoSimples` da empresa e RBT12) dá
  `aliquotaNominal`/`parcelaDeduzir`; `aliquotaEfetiva = (RBT12 ×
  aliquotaNominal − parcelaDeduzir) / RBT12`; `valorDevido =
  receitaBrutaTotal(mês) × aliquotaEfetiva`. Diferente do redutor do
  carnê-leão, essa fórmula é pacífica e documentada — não há flag de
  incerteza equivalente ao `calculoIncerto` neste módulo.
- **`DASApuracao.detalheCalculo` sempre registra o rastro do cálculo** —
  MEI grava `{ tipo: "fixo", valorTabelado }`, Simples grava `{ rbt12,
  anexo, aliquotaNominal, parcelaDeduzir, aliquotaEfetiva }`. Nunca esconde
  como o número saiu, útil para auditoria/debug — mesmo princípio do
  carnê-leão.
- **Vencimento do DAS = dia 20 do mês seguinte à competência**, recuando
  para o dia útil anterior se cair em sábado ou domingo. Sem calendário de
  feriados nacionais nesta etapa — aproximação, não a data oficial exata
  em todos os casos (mesma simplificação já aceita no carnê-leão).
- **Limite anual do MEI é proporcional aos meses de atividade no
  ano-calendário**, contados a partir de `dataAbertura` (empresa aberta em
  julho tem limite proporcional aos 6 meses restantes daquele ano).
  `percentualAtingido = receitaAcumuladaAno / limiteProporcional`.
  `alerta` tem 4 estados: `ok` (abaixo de 80%), `atencao_80pct` (80–100%),
  `excedeu_20pct` (estourou até 20% acima — fica no MEI, paga diferença de
  imposto proporcional), `excedeu_mais_20pct` (estourou mais de 20% —
  desenquadramento retroativo do MEI desde janeiro do ano-calendário). A
  UI precisa deixar esse último estado claro, não só mostrar o número.
- **Pró-labore reusa a tabela progressiva mensal do IR** já existente em
  `ParametroFiscalPF` (pró-labore é rendimento tributável na pessoa física
  do sócio) — `ProLaboreService` depende de `ParametroFiscalPfService`, sem
  duplicar tabela, só pra calcular `irrfRetido` automaticamente. `inssRetido`
  **não é calculado automaticamente** — é informado pelo usuário no
  lançamento, mesmo tratamento que o carnê-leão já dá ao INSS autônomo
  (`DeducaoCarneLeao.tipo = INSS_AUTONOMO`, sempre valor digitado, nunca
  calculado). Alíquota e teto do INSS mudam por lei e não têm hoje nenhuma
  tabela `Parametro*` no schema — criar uma agora seria migration fora do
  escopo combinado ("nenhuma migration nova é necessária"); fica como
  extensão futura se o cálculo automático virar necessidade real.
- **Distribuição de lucros é isenta até `limiteDividendoIsentoMensal`**
  (`ParametroFiscalPJ`, R$50.000/mês em 2026); acima disso, `isento =
  false` mas `impostoRetido` fica em 0 por padrão — não existe hoje uma
  alíquota legal sobre o excedente de distribuição de lucro de ME/MEI, não
  vou inventar uma. O campo `aliquotaDividendoExcedente` em
  `ParametroFiscalPJ` fica reservado para o dia em que essa tributação for
  criada por lei, sem uso nesta etapa.
- **Navegação:** nova aba "Empresa" (ao lado de "Home" e "Carnê-leão").
  Sem empresa cadastrada, mostra CTA de cadastro. Com empresa cadastrada,
  mostra o dashboard mensal da primeira empresa ativa do usuário — sem
  seletor de múltiplas empresas nesta etapa.

### Valores do seed (`ParametroFiscalPJ` e `AnexoSimplesTabela`, ano-calendário 2026)

A implementação **não deve inventar** nenhum destes valores. Precisam ser
fornecidos explicitamente pelo usuário do sistema antes da task que cria o
seed:

- `ParametroFiscalPJ`: `meiLimiteAnual`, `meiDasComercioIndustria`,
  `meiDasServicos`, `meiDasComercioServicos`, `limiteDividendoIsentoMensal`,
  `aliquotaDividendoExcedente` (mesmo que 0/reservado por enquanto).
- `AnexoSimplesTabela`: as 5 tabelas completas (Anexos I a V), cada uma
  com o array de faixas `{ rbt12Ate, aliquota, parcelaDeduzir }`.

Se a implementação chegar a essa task sem esses valores confirmados, a
task deve reportar `NEEDS_CONTEXT` e parar — nunca preencher com números
de exemplo ou de anos anteriores. Todas as outras tasks (incluindo o teste
e2e) usam seus próprios dados de teste ilustrativos e não dependem desse
seed.

## Arquitetura (backend)

```
CarneLeaoModule (existente)          PjModule (novo)
  ParametroFiscalPfService  <───────── ProLaboreService (lê p/ IRRF)

  EmpresaService
  FaturamentoMensalPjService ──cascata──> RBT12Service
                              ──cascata──> DASApuracaoService
                              ──cascata──> AcompanhamentoLimiteMeiService
  DASApuracaoService ──lê──> ParametroFiscalPjService
                     ──lê──> AnexoSimplesTabelaService
                     ──lê──> RBT12Service (via RBT12Cache)
  ProLaboreService
  DistribuicaoLucrosService
  ParametroFiscalPjService
  AnexoSimplesTabelaService
```

8 services + 6 controllers (`Empresa`, `FaturamentoMensalPJ`, `ProLabore`,
`DistribuicaoLucros`, `DASApuracao` (só leitura, mesmo padrão do
`ApuracaoCarneLeaoController`), `AcompanhamentoLimiteMEI` (só leitura)),
todos com `@UseGuards(JwtAuthGuard)` + `@CurrentUser()`, `usuarioId` sempre
do `CurrentUser`, nunca do body. Editar/excluir empresa (ou qualquer
entidade filha) de outro usuário retorna 404, não 403 — mesmo padrão do
carnê-leão.

`PjModule` importa `CarneLeaoModule` (ou reexporta `ParametroFiscalPfService`)
para o `ProLaboreService` calcular IRRF sem duplicar a tabela progressiva.

## Endpoints e regras

### `POST /empresas`
Cria empresa vinculada ao usuário autenticado. Valida CNPJ (formato +
dígito verificador, mesmo padrão de validação de CPF já usado no carnê-leão
e no auth). `anexoSimples` obrigatório se `regime = SIMPLES_ME`, rejeitado
se `regime = MEI`.

### `GET /empresas` / `PATCH /empresas/:id` / `DELETE /empresas/:id`
Lista as empresas do usuário. Editar/excluir de outro usuário → 404.
Excluir cascade-deleta faturamentos, RBT12, apurações, pró-labores e
distribuições (já configurado no schema via `onDelete: Cascade`).

### `POST /faturamentos-pj`
Cria/atualiza faturamento mensal (`receitaBrutaTotal`, opcionalmente
`receitaComNota`/`receitaSemNota`/`clienteTipoPredominante`). Dispara a
cascata de recálculo (RBT12 → DAS → limite MEI).

### `GET /faturamentos-pj?empresaId=&ano=&mes=`
Lista por empresa e mês/ano.

### `PATCH /faturamentos-pj/:id` / `DELETE /faturamentos-pj/:id`
Edita/exclui, redispara a cascata. Empresa de outro usuário → 404.

### `POST /pro-labores` / `GET` / `PATCH` / `DELETE`
CRUD simples, calcula `inssRetido`/`irrfRetido` no create/update a partir
do `valor` e da tabela do IR vigente no ano da competência.

### `POST /distribuicoes-lucros` / `GET` / `PATCH` / `DELETE`
CRUD simples, calcula `isento`/`impostoRetido` no create/update.

### `GET /das-apuracoes?empresaId=&ano=&mes=`
Só leitura — resultado da última cascata de recálculo daquela competência.
Retorna `200` com corpo `null` se ainda não há faturamento lançado pro mês
— **mesmo padrão do `apuracoes-carne-leao`**, não um erro (mês sem
lançamento é um estado normal, não uma falha). O cliente HTTP compartilhado
do frontend (`frontend/src/lib/api.ts`) já trata corpo vazio como `null`
desde a correção feita no carnê-leão — nenhum ajuste adicional necessário
no cliente.

### `GET /acompanhamento-limite-mei?empresaId=&ano=`
Só leitura — estado atual do limite MEI daquele ano-calendário. `404` se a
empresa não é regime MEI.

## O algoritmo de cálculo

**RBT12** (`RBT12Service.recalcular(empresaId, competencia)`):
1. Busca os faturamentos dos últimos 12 meses (janela móvel terminando na
   competência).
2. Se a empresa tem 12+ meses de atividade (competência − dataAbertura ≥
   12 meses): `rbt12 = soma dos 12 faturamentos`.
3. Se tem menos de 12 meses: `rbt12 = (soma do faturamento desde a
   abertura ÷ meses de atividade) × 12`.
4. `upsert` em `RBT12Cache` por `empresaId` + `competencia`.

**DAS** (`DASApuracaoService.recalcular(empresaId, competencia)`):
1. Lê `Empresa.regime`.
2. Se `MEI`: `valorDevido` = valor fixo de `ParametroFiscalPJ` conforme
   `atividadeTipo`. `detalheCalculo = { tipo: "fixo", valorTabelado }`.
3. Se `SIMPLES_ME`: lê `RBT12Cache` da competência, busca a faixa
   correspondente em `AnexoSimplesTabela` (filtrado por `anexoSimples` +
   `rbt12Ate >= rbt12`, pega a primeira faixa que cobre), calcula
   `aliquotaEfetiva` e `valorDevido = receitaBrutaTotal(mês) ×
   aliquotaEfetiva`. `detalheCalculo = { rbt12, anexo, aliquotaNominal,
   parcelaDeduzir, aliquotaEfetiva }`.
4. `vencimento` = dia 20 do mês seguinte, recuando pra sexta se cair em
   fim de semana.
5. `upsert` em `DASApuracao` por `empresaId` + `competencia`, preservando
   `status` já setado manualmente (mesmo comportamento do carnê-leão: o
   `update` do upsert não sobrescreve `status`, só os valores calculados).

**Limite MEI** (`AcompanhamentoLimiteMeiService.recalcular(empresaId, anoCalendario)`):
1. Só roda se `Empresa.regime = MEI`.
2. `mesesDeAtividade` = meses entre `dataAbertura` (ou 1º de janeiro do
   ano, o que for depois) e dezembro daquele ano-calendário.
3. `limiteProporcional = (meiLimiteAnual / 12) × mesesDeAtividade`.
4. `receitaAcumuladaAno` = soma de todo `FaturamentoMensalPJ` daquele ano.
5. `percentualAtingido = receitaAcumuladaAno / limiteProporcional`.
6. `alerta` conforme as 4 faixas descritas em "Decisões".
7. `upsert` em `AcompanhamentoLimiteMEI` por `empresaId` + `anoCalendario`.

## Frontend (Expo / expo-router)

- **`pj-api.ts`** (`@/lib/pj-api`) — tipos + `createEmpresa`,
  `updateEmpresa`, `deleteEmpresa`, `createFaturamento`,
  `updateFaturamento`, `deleteFaturamento`, `createProLabore`,
  `updateProLabore`, `deleteProLabore`, `createDistribuicaoLucros`,
  `updateDistribuicaoLucros`, `deleteDistribuicaoLucros` — mesmo padrão do
  `carne-leao-api.ts`.
- **`useEmpresaMes`** (`@/hooks/use-empresa-mes`) — hook análogo ao
  `useCarneLeaoMes`: busca a primeira empresa ativa do usuário, e pro mês
  selecionado: faturamento, DAS, limite MEI (se aplicável), pró-labores,
  distribuições. Guarda de corrida por request-id, refetch em
  `useFocusEffect`, mesmo padrão do carnê-leão.
- **Aba "Empresa"** (`(tabs)/empresa.tsx`) — nova aba, terceira ao lado de
  Home e Carnê-leão. Sem empresa: CTA de cadastro. Com empresa: dashboard
  mensal navegável por ◀/▶, cards de faturamento/RBT12/DAS/limite MEI,
  listas de pró-labore e distribuição com tap-para-editar e
  long-press-para-excluir (mesma ressalva do carnê-leão: `Alert.alert` não
  funciona em `react-native-web`, validar exclusão via API/curl na
  verificação manual).
- **Telas modais**: `cadastrar-empresa.tsx`, `lancar-faturamento.tsx`,
  `lancar-pro-labore.tsx`, `lancar-distribuicao-lucros.tsx` — registradas
  no `Stack` de `(app)/_layout.tsx` junto com as já existentes.

## Erros e testes

- 401 sem token; 404 em editar/excluir empresa (ou entidade filha) de
  outro usuário; 400 em CNPJ inválido, `anexoSimples` ausente quando
  `SIMPLES_ME`, `anexoSimples` presente quando `MEI`.
- `ParametroFiscalPjService`/`AnexoSimplesTabelaService` lançam 404 claro
  se o ano-calendário não tem dado cadastrado — nunca calculam com dado
  ausente (mesmo princípio do `ParametroFiscalPfService`).
- Casos de fronteira a cobrir explicitamente nos testes unitários: troca
  de faixa do Anexo exatamente no limite do RBT12; RBT12 proporcional pra
  empresa com menos de 12 meses; os 4 estados do alerta de limite MEI
  (incluindo a transição exata em 80% e nos dois limiares de estouro);
  isenção vs tributação da distribuição de lucros no valor exato do
  limite; MEI não usa RBT12 nem Anexo em nenhum caminho de código;
  `irrfRetido` do pró-labore usa a tabela do `ParametroFiscalPF` do ano da
  competência, `inssRetido` nunca é sobrescrito pelo valor calculado (é
  sempre o que o usuário informou).
- E2e com ano fictício (mesmo padrão do carnê-leão, `ANO_TESTE` dedicado
  não usado em nenhum seed real): cadastra empresa Simples, lança
  faturamento por 2-3 meses confirmando RBT12 recalculando, confere DAS,
  lança pró-labore e distribuição, testa isolamento entre usuários (404
  cross-user). Repetir um teste focado equivalente pro caminho MEI (DAS
  fixo, sem RBT12, acompanhamento de limite).

## Fora de escopo (explicitamente adiado)

- Seleção de múltiplas empresas por usuário na UI (schema suporta, telas
  não).
- Abertura/baixa de CNPJ, geração de boleto/DARF real, integração com o
  PGDAS-D ou qualquer sistema externo da Receita.
- Emissão de nota fiscal.
- Calendário de feriados nacionais para vencimento exato do DAS.
- Tributação sobre distribuição de lucros excedente ao limite isento —
  campo `aliquotaDividendoExcedente` reservado no schema, sem lógica.
- Ligação com a declaração anual de IR (módulo de documentos
  fiscais/bens e direitos, ainda não iniciado).
- Geração de relatório em PDF do módulo PJ (módulo de relatórios, ainda
  não iniciado).
