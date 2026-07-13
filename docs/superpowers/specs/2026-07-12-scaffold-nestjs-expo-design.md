# Scaffold inicial: NestJS (backend) + Expo (frontend)

## Contexto

O projeto (`docs/PROJETO.md`, `CLAUDE.md`) já define a stack: NestJS + Prisma + PostgreSQL no backend, React Native com Expo no frontend, monorepo com `backend/`, `frontend/`, `shared/` e `docs/`. O `schema.prisma` (módulos core financeiro, IR Pessoa Física/Carnê-Leão e PJ/MEI-ME) já está em `backend/prisma/schema.prisma`. Este documento cobre apenas o **scaffold inicial** dos dois projetos e da integração entre eles — nenhuma lógica de negócio (auth, transações, cálculo fiscal) entra aqui.

Deploy final é uma SaaS em VPS via cPanel (subdomínio `adm.marcosaraujo.de.br`), usando Node.js Selector (Passenger). Isso não afeta o scaffold local, mas deve ser revisado numa spec própria antes de ir para produção (entry point/porta compatível com Passenger).

## Decisões

- **Package manager:** npm, usando **npm workspaces** para ligar `backend`, `frontend` e `shared` num único `npm install` na raiz.
- **Scaffold via geradores oficiais:** `nest new backend` e `npx create-expo-app frontend` (template TypeScript + Expo Router), depois ajustados à estrutura do monorepo. Não escrever os arquivos de configuração à mão.
- **Banco local:** PostgreSQL via Docker Compose (container único, volume nomeado, porta 5432).
- **Escopo do backend:** só o esqueleto do `nest new` + integração com Prisma (`PrismaModule` global + `PrismaService`). Nenhum módulo de domínio (auth, usuarios, workspaces, transacoes, fiscal-pf, fiscal-pj) é criado ainda — cada um terá seu próprio design/spec quando for implementado.
- **Navegação no Expo:** Expo Router (file-based, `app/`), padrão atual do template oficial.
- **Pacote `shared`:** existe como pacote npm real (`@app-finance/shared`) desde já, mas só com um `index.ts` placeholder — sem tipos ainda, porque não há módulos de domínio no backend para gerar tipos compartilháveis.
- **Testes/CI:** nenhuma configuração além do que os geradores trazem por padrão (Jest no Nest e no Expo). Fora de escopo adicionar cobertura ou pipeline agora.

## Estrutura resultante

```
Sistema-finance/
├── package.json            # raiz, "workspaces": ["backend", "frontend", "shared"]
├── docker-compose.yml       # Postgres para dev local
├── .env.example             # DATABASE_URL, JWT_SECRET (documentado, sem valores reais)
├── backend/
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   └── prisma/
│   │       ├── prisma.module.ts   # @Global(), exporta PrismaService
│   │       └── prisma.service.ts  # extends PrismaClient, hooks onModuleInit/onModuleDestroy
│   ├── prisma/
│   │   └── schema.prisma          # já existente
│   ├── test/                      # e2e padrão do Nest
│   └── .env                       # git-ignored
├── frontend/
│   ├── app/
│   │   ├── _layout.tsx
│   │   └── index.tsx              # tela placeholder
│   ├── assets/                    # já existente
│   ├── src/lib/api.ts             # cliente HTTP base, URL vinda de env
│   └── .env / app.config.ts       # EXPO_PUBLIC_API_URL
├── shared/
│   ├── package.json                # "@app-finance/shared"
│   ├── tsconfig.json
│   └── src/index.ts                 # placeholder de export
└── docs/
```

> **Nota pós-implementação:** o template atual do `create-expo-app` (SDK 57) usa layout `src/`, então as rotas do Expo Router ficaram em `frontend/src/app/` em vez do `frontend/app/` ilustrado acima — sem impacto no restante do design. `frontend/tsconfig.json` mapeia `@/*` para `./src/*`, então o import de `api.ts` é `@/lib/api`, não `@/src/lib/api`.

`backend` e `frontend` declaram `"@app-finance/shared": "*"` como dependência, resolvida localmente pelo workspace.

## Scripts (raiz `package.json`)

```json
{
  "scripts": {
    "dev:backend": "npm run start:dev -w backend",
    "dev:frontend": "npm run start -w frontend",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down"
  }
}
```

## Fora de escopo

- Módulos de domínio no NestJS (auth, usuarios, workspaces, transacoes, fiscal-pf, fiscal-pj) — cada um é uma spec/plano separado.
- Telas de negócio no Expo (login, lançamento de transação, etc.).
- Configuração de deploy/Passenger para o cPanel.
- Testes além do padrão dos geradores, CI/CD.
- Tipos compartilhados reais em `shared/` (depende dos módulos de domínio existirem).
