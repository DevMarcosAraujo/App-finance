# App-finance

Sistema financeiro familiar (uso próprio: Marcos + esposa) com plano de evoluir
para SaaS multiusuário (planos individual e família). iOS/Android via app único.

## Stack

- **Frontend:** React Native com Expo (`frontend/`)
- **Backend:** Node.js com NestJS, TypeScript (`backend/`)
- **Banco:** PostgreSQL com Prisma ORM (`backend/prisma/schema.prisma`)
- **Auth:** JWT com suporte a biometria
- **Alternativa MVP:** Supabase cogitado como atalho para fases iniciais

## Estrutura de pastas

```
App-finance/
├── backend/       # NestJS + Prisma
├── frontend/      # React Native / Expo
├── shared/        # tipos/contratos compartilhados
└── docs/
    └── PROJETO.md # objetivos, roadmap, decisões (documento vivo)
```

## Modelo de conta multiusuário

Usuário escolhe conta **individual** ou **compartilhada** (casal/família). Na
conta compartilhada, todos os membros compartilham o workspace financeiro, mas
cada transação é tagueada com quem a registrou (`Transacao.usuarioId`) —
permite dashboard conjunto **e** visão individual filtrada. Monetização por
planos (`Plano`: INDIVIDUAL vs FAMILIA), com custo adicional por membro extra.

## Princípio de design mais importante: nada de regra fiscal hardcoded

Toda alíquota, faixa de isenção, teto de dedução ou tabela do Simples Nacional
vive em tabelas *Parametro*/*Tabela* versionadas por ano-calendário
(`ParametroFiscalPF`, `ParametroFiscalPJ`, `AnexoSimplesTabela`), editáveis via
admin, sem deploy. Isso é o que permite virar SaaS sem reescrever nada quando
a legislação mudar ou quando um novo usuário tiver atividade/Anexo diferente.
**Nunca sugerir hardcode de valores fiscais no código** — sempre ler do banco.

## Módulos do sistema (ver `backend/prisma/schema.prisma`)

1. **Core financeiro**: `Usuario`, `Workspace`, `WorkspaceMembro`, `Transacao`,
   `Categoria`, `Plano`, `RelatorioGerado` (PDF mensal/bimestral/semestral/anual).
2. **IR Pessoa Física**: `DocumentoFiscal` (nota fiscal/recibo, com emissor
   CPF ou CNPJ — importante pra dedução de saúde/educação), `BemDireito`
   (snapshot patrimonial, não é fluxo de caixa), `ParametroFiscalPF`.
   - **Carnê-leão** (apuração mensal obrigatória p/ renda de PF sem retenção):
     `RendimentoAutonomo`, `DeducaoCarneLeao`, `LivroCaixaLancamento`,
     `ApuracaoMensalCarneLeao`. Atenção: despesas de saúde/educação **não**
     entram no carnê-leão, só na declaração anual — são fluxos separados.
3. **Módulo PJ (MEI/ME)**: `Empresa` (regime MEI ou SIMPLES_ME),
   `FaturamentoMensalPJ`, `RBT12Cache` (só relevante p/ SIMPLES_ME),
   `DASApuracao`, `ProLabore`, `DistribuicaoLucros`,
   `AcompanhamentoLimiteMEI`, `ParametroFiscalPJ`, `AnexoSimplesTabela`.

## Situação real de vocês (contexto de negócio, não regra do sistema)

- Marcos: hoje só CPF; planeja abrir MEI.
- Esposa: já tem CNPJ ME (Simples Nacional) + rendimentos em CPF.
- Declaração de IR: **separada** (cada um declara o seu) — o sistema já é
  desenhado pra isso, cada entidade fiscal é vinculada a `titular_id`/CPF.

## Pontos em aberto / cuidado

- Fórmula exata do redutor de IR para faixa mensal R$5.000–7.350 (Lei
  15.270/2025, regra nova de 2026) ainda não confirmada oficialmente —
  `ApuracaoMensalCarneLeao.calculoIncerto` sinaliza isso; nunca inventar a
  fórmula, mostrar aviso "confirme no Carnê-Leão Web" nesse caso.
- Tabela dos Anexos I-V do Simples Nacional é cadastrada pelo usuário/admin
  no momento de configurar cada `Empresa`, nunca pré-populada com valor
  adivinhado.

## Geração de PDF (relatórios)

Motor determinístico no backend (ex: `Puppeteer` ou `react-pdf`), **não** via
chamada de IA por relatório — mais barato e consistente em produção. IA
(Claude via API) reservada para insights pontuais dentro do relatório (ex:
resumo textual de gastos do mês), não para gerar o documento inteiro.

## Git

Repo: `github.com/DevMarcosAraujo/App-finance`. Push usa HTTPS com PAT
embutido temporariamente na URL remota, resetado para URL sem token depois.
Configurar identidade git local antes do primeiro commit.

## Próximos passos

1. Rodar `npx prisma migrate dev` a partir do schema em `backend/prisma/`
2. Scaffold do NestJS (`backend/`) e do Expo (`frontend/`)
3. `CarneLeaoService` e `DASApuracaoService` (cálculo a partir dos parâmetros)
4. Autenticação JWT + biometria
5. Telas mobile de lançamento de transação, rendimento autônomo e despesa PJ
