# Design: Carnê-leão

Data: 2026-07-16

## Contexto

Com o núcleo financeiro (transações + categorias) mergeado, este design
cobre o **carnê-leão** — apuração mensal obrigatória de IR sobre renda de
pessoa física recebida sem retenção na fonte (honorários, aluguel PF,
pensão recebida, rendimento do exterior). Os models já existem em
`backend/prisma/schema.prisma`: `RendimentoAutonomo`, `DeducaoCarneLeao`,
`LivroCaixaLancamento`, `ApuracaoMensalCarneLeao`, `ParametroFiscalPF` —
nenhuma migration nova é necessária.

Diferença importante em relação ao núcleo financeiro: **todos esses models
são vinculados a `usuarioId`, não a `workspaceId`** — o carnê-leão é
individual por pessoa física (cada um declara o seu, conforme o
`CLAUDE.md`), independente de quem mais estiver no mesmo workspace
financeiro. Nenhuma rota deste módulo usa `WorkspaceGuard`.

Não cobre: upload real de comprovantes, calendário de feriados para
vencimento exato, ligação com o módulo PJ ou com a declaração anual, admin
UI para editar parâmetros fiscais, nem exportação pro Carnê-Leão Web oficial
— ver "Fora de escopo".

## Decisões

- **Escopo completo nesta etapa**: CRUD de rendimentos autônomos, CRUD de
  deduções, CRUD de itens de livro-caixa, cálculo automático da apuração
  mensal, e telas mobile completas para tudo isso.
- **`ParametroFiscalPF` populado via auto-seed no boot**, mesmo padrão já
  usado para `Plano`/`Categoria` (o service checa `count()` antes de
  inserir — roda uma vez). Os valores oficiais de 2026 são fornecidos pelo
  usuário do sistema (não inventados pelo agente que implementa este
  design) — ver "Valores do seed" abaixo.
- **Recalculo automático da apuração**: toda vez que um `RendimentoAutonomo`,
  `DeducaoCarneLeao` ou `LivroCaixaLancamento` daquele mês é criado,
  atualizado ou excluído, `ApuracaoMensalCarneLeao` daquela competência é
  recalculada e sobrescrita (`upsert` por `usuarioId` + `competencia`).
- **Livro-caixa é sempre somado automaticamente.** O usuário só lança itens
  em `LivroCaixaLancamento` (despesas do mês: aluguel de escritório,
  material, conselho de classe, etc.). A dedução "livro caixa" na apuração
  é a soma desses lançamentos do mês — nunca lançada manualmente como
  `DeducaoCarneLeao`. O tipo `LIVRO_CAIXA` do enum `TipoDeducaoCarneLeao`
  fica sem uso direto nesta etapa (não é aceito pelo DTO de criação de
  dedução).
- **Desconto simplificado é uma alternativa às deduções detalhadas, não
  soma com elas** — reflete a regra real do carnê-leão (o contribuinte usa
  a soma das deduções detalhadas OU o desconto simplificado mensal, o que
  for maior). A apuração escolhe automaticamente a opção mais vantajosa
  para o usuário a cada mês.
- **Faixa de cálculo incerto (Lei 15.270/2025, regra nova de 2026):** a
  fórmula exata do redutor de IR para base de cálculo mensal entre
  `faixaIsencaoMensal` (R$5.000) e `faixaReducaoAte` (R$7.350) não está
  oficialmente confirmada. Nessa faixa, a apuração aplica a tabela
  progressiva normal **sem** nenhum redutor especial, marca
  `calculoIncerto = true`, e a UI mostra aviso "confira no Carnê-Leão Web —
  valor pode estar superestimado". Abaixo de R$5.000: isento
  (`impostoDevido = 0`). Acima de R$7.350: tabela progressiva normal, sem
  aviso.
- **Vencimento (DARF código 0190) = último dia do mês seguinte à
  competência**, recuando para a sexta-feira anterior se cair em sábado ou
  domingo. Sem calendário de feriados nacionais nesta etapa — é uma
  aproximação, não a data oficial exata em todos os casos.
- **Navegação:** nova aba "Carnê-leão" no lugar da aba "Explore" (ainda
  boilerplate do Expo, sem uso real).

### Valores do seed de `ParametroFiscalPF` (ano-calendário 2026)

A implementação **não deve inventar** nenhum destes valores. Eles devem ser
fornecidos explicitamente antes ou durante a implementação da Task que cria
o seed (via o usuário do sistema, não adivinhados pelo modelo). Campos que
precisam de valor oficial confirmado:

- `faixaIsencaoMensal`, `faixaReducaoAte`, `tetoEducacaoAnual`,
  `valorDependenteMensal`, `descontoSimplificadoMensal`,
  `limiteObrigatoriedadeDeclaracao`, `tabelaProgressivaMensal` (array de
  `{ ate, aliquota, parcelaDeduzir }`).

Se a implementação chegar a essa task sem esses valores confirmados, a task
deve parar e pedir os valores — não prosseguir com números de exemplo.

## Arquitetura (backend)

Um único módulo `carne-leao` (não separado por entidade como
`categoria`/`transacao`) — rendimentos, deduções, livro-caixa e apuração só
fazem sentido juntos: toda mudança em qualquer um dispara recálculo do
outro. Separar em módulos distintos criaria import cruzado sem benefício.

```
backend/src/carne-leao/
├── carne-leao.module.ts
├── rendimento-autonomo.service.ts       # CRUD RendimentoAutonomo
├── rendimento-autonomo.controller.ts    # /rendimentos-autonomos
├── deducao-carne-leao.service.ts        # CRUD DeducaoCarneLeao (INSS/pensão/PGBL)
├── deducao-carne-leao.controller.ts     # /deducoes-carne-leao
├── livro-caixa.service.ts               # CRUD LivroCaixaLancamento
├── livro-caixa.controller.ts            # /livro-caixa
├── parametro-fiscal-pf.service.ts       # auto-seed + leitura de ParametroFiscalPF
├── apuracao-carne-leao.service.ts       # motor de cálculo, chamado pelos 3 CRUDs acima
├── apuracao-carne-leao.controller.ts    # GET /apuracoes-carne-leao (só leitura)
└── dto/
    ├── create-rendimento-autonomo.dto.ts / update-rendimento-autonomo.dto.ts
    ├── create-deducao-carne-leao.dto.ts / update-deducao-carne-leao.dto.ts
    └── create-livro-caixa.dto.ts / update-livro-caixa.dto.ts
```

Todas as rotas protegidas só por `@UseGuards(JwtAuthGuard)` +
`@CurrentUser()` — sem `WorkspaceGuard`.

## Endpoints e regras

### `POST /rendimentos-autonomos`
```ts
class CreateRendimentoAutonomoDto {
  @IsEnum(TipoRendimentoAutonomo)
  tipo: TipoRendimentoAutonomo; // HONORARIO | ALUGUEL_PF | PENSAO_RECEBIDA | EXTERIOR

  @ValidateIf((o) => o.tipo !== 'EXTERIOR')
  @IsNotEmpty()
  @IsCpf() // reaproveita o validador já existente em auth/validators
  fontePagadoraCpf?: string;

  @IsNumber()
  @IsPositive()
  valorBruto: number;

  @IsOptional()
  @IsUUID()
  documentoFiscalId?: string;

  @IsDateString()
  competencia: string;
}
```
- `usuarioId` sempre vem do `CurrentUser`, nunca do body.
- `fontePagadoraCpf` obrigatório exceto quando `tipo = EXTERIOR`.
- Após criar/atualizar/excluir, chama
  `ApuracaoCarneLeaoService.recalcular(usuarioId, competencia)`.

### `GET /rendimentos-autonomos?ano=2026&mes=7`
- Lista os rendimentos do usuário atual na competência informada, ordenados
  por `criadoEm` desc.

### `PATCH /rendimentos-autonomos/:id` / `DELETE /rendimentos-autonomos/:id`
- Verifica que o registro pertence ao usuário atual — `404` se não
  pertencer (mesmo padrão de não vazar existência usado em `Transacao`).
- Dispara recálculo da competência afetada.

### `POST /deducoes-carne-leao`
```ts
class CreateDeducaoCarneLeaoDto {
  @IsIn(['INSS_AUTONOMO', 'PENSAO_JUDICIAL', 'PGBL']) // LIVRO_CAIXA não aceito aqui
  tipo: 'INSS_AUTONOMO' | 'PENSAO_JUDICIAL' | 'PGBL';

  @IsNumber()
  @IsPositive()
  valor: number;

  @IsOptional()
  @IsString()
  anexoUrl?: string;

  @IsDateString()
  competencia: string;
}
```
- Mesmo padrão de `usuarioId`, `PATCH`/`DELETE` com checagem de
  pertencimento (`404`), e recálculo automático do `GET`/`POST`/
  `rendimentos-autonomos`.

### `POST /livro-caixa`
```ts
class CreateLivroCaixaDto {
  @IsString()
  @IsNotEmpty()
  descricao: string;

  @IsString()
  @IsNotEmpty()
  categoria: string; // texto livre (aluguel_escritorio, material, etc.)

  @IsNumber()
  @IsPositive()
  valor: number;

  @IsDateString()
  competencia: string;
}
```
- Mesmo padrão de `usuarioId`, `PATCH`/`DELETE`, recálculo automático.

### `GET /apuracoes-carne-leao?ano=2026&mes=7`
- Só leitura — não existe `POST`/`PATCH` direto, a apuração só é produzida
  pelo `ApuracaoCarneLeaoService.recalcular`.
- Se não existir apuração para a competência (usuário sem nenhum
  lançamento naquele mês ainda), retorna `null` — o frontend trata como
  "nenhum lançamento este mês, R$0,00".
- Retorna `{ rendimentoBrutoTotal, deducoesTotal, baseCalculo,
  aliquotaEfetiva, impostoDevido, codigoReceita, vencimento, status,
  calculoIncerto }`.

## O algoritmo de cálculo

`ApuracaoCarneLeaoService.recalcular(usuarioId, competencia)`, disparado
automaticamente pelos três CRUDs acima após qualquer mutação na
competência afetada:

1. `rendimentoBrutoTotal` = soma de `RendimentoAutonomo.valorBruto` do
   usuário na competência.
2. `deducoesDetalhadasTotal` = soma de `DeducaoCarneLeao.valor` (tipos
   `INSS_AUTONOMO`/`PENSAO_JUDICIAL`/`PGBL`) **+** soma de
   `LivroCaixaLancamento.valor` do mês.
3. Lê `ParametroFiscalPF` do ano da competência (`competencia.getFullYear()`).
   Se não existir parâmetro cadastrado pro ano, lança erro claro ("parâmetro
   fiscal do ano `<ano>` não cadastrado") em vez de calcular com dados
   ausentes.
4. `deducoesTotal = max(deducoesDetalhadasTotal, descontoSimplificadoMensal)`.
5. `baseCalculo = max(0, rendimentoBrutoTotal - deducoesTotal)`.
6. Três zonas, usando `faixaIsencaoMensal` e `faixaReducaoAte` do parâmetro:
   - `baseCalculo <= faixaIsencaoMensal` → isento, `impostoDevido = 0`,
     `aliquotaEfetiva = 0`, `calculoIncerto = false`.
   - `faixaIsencaoMensal < baseCalculo <= faixaReducaoAte` → aplica a
     tabela progressiva normal (sem redutor), `calculoIncerto = true`.
   - `baseCalculo > faixaReducaoAte` → aplica a tabela progressiva normal,
     `calculoIncerto = false`.
7. Tabela progressiva (`tabelaProgressivaMensal`, array
   `{ ate, aliquota, parcelaDeduzir }`): encontra a primeira faixa onde
   `baseCalculo <= faixa.ate`; `impostoDevido = max(0, baseCalculo *
   faixa.aliquota - faixa.parcelaDeduzir)`.
8. `aliquotaEfetiva = baseCalculo > 0 ? impostoDevido / baseCalculo : 0`.
9. `vencimento` = último dia do mês seguinte à competência; se cair em
   sábado ou domingo, recua pra sexta-feira anterior.
10. `status`: o `upsert` só escreve `PENDENTE` na criação (quando a
    competência ainda não tem apuração); em recálculos de uma apuração já
    existente, o campo `status` não entra no payload de update — o
    recálculo mexe só nos valores calculados. Não há endpoint nesta etapa
    para mudar `status` manualmente (ver "Fora de escopo"), então hoje isso
    é só um detalhe mecânico do `upsert`, não uma feature em uso.
11. `upsert` em `ApuracaoMensalCarneLeao` por `usuarioId` + `competencia`.

## Frontend (Expo / expo-router)

```
frontend/src/
├── hooks/
│   └── use-carne-leao-mes.ts       # busca rendimentos+deduções+livro-caixa+apuração em paralelo
├── lib/
│   └── carne-leao-api.ts           # tipos + funções de mutação das 3 entidades
└── app/
    └── (app)/
        ├── (tabs)/
        │   └── carne-leao.tsx          # substitui explore.tsx
        ├── lancar-rendimento.tsx       # modal, criar/editar (id opcional via param)
        ├── lancar-deducao.tsx          # modal, criar/editar
        └── lancar-livro-caixa.tsx      # modal, criar/editar
```

**`useCarneLeaoMes(ano, mes)`**: dispara as 4 chamadas (`GET
/rendimentos-autonomos`, `/deducoes-carne-leao`, `/livro-caixa`,
`/apuracoes-carne-leao`, todas com `?ano=&mes=`) em paralelo via
`Promise.all`. Expõe `{ rendimentos, deducoes, livroCaixa, apuracao,
isLoading, error, refetch }` — mesmo guard de request stale (`requestIdRef`)
usado em `useTransacoes`, já que a tela também navega entre meses.

**`(tabs)/carne-leao.tsx`**: topo com navegação de mês (◀ Julho 2026 ▶,
mesmo padrão da Home), depois:
- **Card de apuração**: rendimento bruto, deduções, base de cálculo,
  imposto devido, alíquota efetiva, vencimento; se `apuracao === null`,
  mostra "nenhum lançamento este mês"; se `calculoIncerto`, mostra o aviso
  em destaque.
- **Seção Rendimentos**: lista + botão "+" → `lancar-rendimento`.
- **Seção Deduções**: lista + botão "+" → `lancar-deducao`.
- **Seção Livro-caixa**: lista + botão "+" → `lancar-livro-caixa`.

Tap num item de qualquer seção abre o modal correspondente em modo edição
(mesmo padrão de `nova-transacao`: `id` + campos atuais via params).
Long-press exclui com confirmação — mesma ressalva já conhecida do módulo
de transações: `Alert.alert` não funciona no modo web do Expo
(`react-native-web` é um no-op), então a confirmação de exclusão só é
testável de fato em iOS/Android real; verificação manual em web usa
chamada direta à API.

## Erros e testes

**Erros:** `401` sem token; `400` DTO inválido (`valorBruto`/`valor`
ausente ou negativo, `tipo` fora do enum, `fontePagadoraCpf` ausente
quando `tipo !== EXTERIOR`); `404` lançamento não encontrado ou pertencente
a outro usuário; erro explícito (não `500` silencioso) se
`ParametroFiscalPF` do ano não existir.

**Testes backend (Jest):**
- Unit de cada CRUD (rendimento, dedução, livro-caixa): create, list por
  competência, update, delete, e o caso de tentar editar/excluir um
  lançamento de outro usuário (deve `404`).
- Unit `DeducaoCarneLeaoService`: `LIVRO_CAIXA` rejeitado como tipo válido
  no create.
- Unit dedicado `ApuracaoCarneLeaoService`: as três zonas (isento/incerto/
  normal), escolha entre dedução detalhada vs desconto simplificado
  (ambos os lados vencendo em casos diferentes), tabela progressiva
  aplicada corretamente, cálculo de vencimento incluindo recuo de fim de
  semana, preservação de `status` já definido em recálculos subsequentes,
  e o erro explícito quando falta `ParametroFiscalPF` do ano.
- Unit `ParametroFiscalPFService`: seed roda só se a tabela estiver vazia
  para aquele ano (idempotente).
- E2E: lançar rendimento → apuração recalcula → lançar dedução → apuração
  muda → editar/excluir lançamento → apuração reflete → lançamento/
  apuração de outro usuário não acessível (`404`).

**Testes frontend:** sem test runner configurado (mesma situação dos
módulos anteriores) — verificação via `tsc --noEmit` + validação manual.

## Fora de escopo (explicitamente adiado)

- Upload real de comprovante (`anexoUrl`/`documentoFiscalId` ficam como
  campo de texto opcional, sem seletor de arquivo).
- Calendário de feriados nacionais no cálculo de vencimento.
- Ligação com o módulo PJ (`Empresa`, `DASApuracao`) ou com a declaração
  anual (`DocumentoFiscal`, `BemDireito`) — módulos separados, fora deste
  design.
- Admin UI para editar `ParametroFiscalPF` — fica só o auto-seed nesta
  etapa; atualização de ano/valores futuros exige edição manual no banco
  até existir um admin.
- Exportação pro Carnê-Leão Web oficial da Receita (CSV/XML).
- Notificação/lembrete de vencimento.
- Marcar apuração como `PAGO`/`ATRASADO` manualmente pela UI (o campo
  `status` existe e é preservado pelo recálculo, mas a ação de marcar como
  paga não tem endpoint/tela nesta etapa — fica pra uma iteração pequena
  seguinte).
