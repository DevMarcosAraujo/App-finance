# App-finance — Documento do Projeto

## 1. Visão geral

O App-finance é um aplicativo de controle financeiro pessoal e familiar com acompanhamento de investimentos. O objetivo é unificar, em um único lugar, o controle do dia a dia (receitas, despesas, orçamento) com uma visão clara da evolução patrimonial e dos investimentos, permitindo uso individual ou compartilhado entre casal/família — com identificação de quem registrou cada movimentação.

## 2. Problema que resolve

Hoje é comum ter o controle financeiro espalhado: um app para gastos, uma planilha para investimentos, e nenhuma visão conjunta com o parceiro(a). O App-finance resolve isso ao oferecer:

- Um só lugar para ver "quanto tenho, quanto gasto e quanto investi"
- Transparência entre casal sem perder a identificação individual de cada gasto
- Visão de patrimônio total (líquido + investido) em tempo real

## 3. Funcionalidades

### 3.1 Controle financeiro (dia a dia)
- Registro de receitas e despesas (manual ou importação de extrato/CSV)
- Categorização de gastos (fixos, variáveis, lazer, etc.)
- Orçamento mensal por categoria, com alertas de estouro
- Múltiplas contas bancárias e cartões
- Metas de economia (ex: "guardar 500€/mês")
- Relatórios visuais (gráficos de gastos por categoria e evolução mensal)

### 3.2 Investimentos
- Acompanhamento de carteira (ações, fundos, cripto, renda fixa)
- Cálculo de rentabilidade e evolução de patrimônio
- Comparação com índices de referência (ex: S&P500, IBOV)
- Visão de diversificação por classe de ativo
- Simulador de aportes futuros (projeção de patrimônio)

### 3.3 Funcionalidades transversais
- Dashboard único com patrimônio total (líquido + investido)
- Notificações inteligentes (contas a pagar, oportunidades, metas atingidas)
- Exportação de relatórios (PDF/Excel)
- Autenticação forte (dado sensível, exige segurança robusta)

## 4. Estrutura de usuários e contas

- Cada pessoa tem login próprio (email/senha ou biometria)
- Ao criar a conta, o usuário escolhe entre:
  - **Conta individual**: uso solo, com opção de convidar alguém depois
  - **Conta compartilhada (casal/família)**: convite de outro usuário por email
- Em conta compartilhada, os membros acessam a mesma carteira financeira, mas **cada movimentação é identificada com quem a registrou**
- Dashboard com visão conjunta e filtros: "meus gastos" / "gastos do parceiro" / "total do casal"
- Conta individual pode ser promovida para compartilhada posteriormente

**Pontos em aberto para definir:**
- Numa conta compartilhada, cada membro tem contas bancárias próprias visíveis separadamente (conta do Marcos + conta da esposa + conta conjunta), ou é uma carteira única onde só o registro do movimento é individual?
- O limite de membros no plano família é fixo (ex: até 2) ou escalável (cobra por pessoa adicional)?

## 5. Modelo de planos

| Plano | Usuários | Observação |
|---|---|---|
| Individual | 1 | 1 carteira |
| Família/Casal | 2+ | Custo adicional por membro extra |

## 6. Estrutura proposta do projeto (repositório)

Estrutura inicial sugerida para organizar o código à medida que o desenvolvimento avança:

```
App-finance/
├── docs/                  # Documentação do projeto (este arquivo, arquitetura, decisões)
├── backend/                # API e lógica de negócio (a definir stack)
│   ├── src/
│   ├── tests/
│   └── ...
├── frontend/                # Aplicativo mobile/web (a definir stack)
│   ├── src/
│   ├── assets/
│   └── ...
├── shared/                  # Tipos/contratos compartilhados entre back e front (se aplicável)
├── .gitignore
└── README.md
```

Essa estrutura é um ponto de partida — vai ser refinada quando definirmos as tecnologias (próxima etapa do projeto).

## 7. Roadmap de decisões

- [x] Definir funcionalidades principais
- [x] Definir estrutura de contas (individual/compartilhada)
- [ ] Definir arquitetura técnica (backend, frontend, banco de dados)
- [ ] Definir stack tecnológica
- [ ] Definir modelo de dados
- [ ] Definir fluxo de autenticação e segurança
- [ ] Definir MVP (o que entra na primeira versão)

## 8. Status

Projeto em fase inicial de planejamento — funcionalidades e estrutura de contas definidas. Próxima etapa: arquitetura e tecnologias.
