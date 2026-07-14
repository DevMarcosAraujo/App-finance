# Design: Módulo de Autenticação

Data: 2026-07-13

## Contexto

Sistema hoje é de uso pessoal (Marcos + esposa), com plano de evoluir pra SaaS
multiusuário. Este design cobre autenticação (registro, login, sessão via
JWT), não a criação de `Workspace`/`Plano` — isso fica pra um fluxo de
onboarding separado, após o primeiro login.

Deploy futuro é via cPanel Node.js Selector (Passenger) numa VPS — isso
descarta dependências nativas compiladas (ex: `argon2`) em favor de
implementações puramente em JS, pra não ter dor de build no ambiente de
deploy.

## Decisões

- **Registro cria só o `Usuario`.** Escolha de plano/workspace é um fluxo de
  onboarding posterior ao primeiro login, fora deste design.
- **Tokens:** access token JWT de vida curta (15min) + refresh token de vida
  longa (30 dias), com registro no Postgres pra permitir revogação
  (`RefreshToken`).
- **Biometria:** fora de escopo nesta etapa. Arquitetura já decidida (o
  backend não sabe nada de biometria — o app usa `expo-local-authentication`
  pra desbloquear localmente o refresh token já salvo no secure storage,
  substituindo digitar a senha de novo), mas a tela/toggle fica pra depois.
- **Hash de senha:** `bcryptjs` (implementação pura em JS, sem binário
  nativo), por causa do destino de deploy via cPanel/Passenger.
- **Validação de CPF:** valida dígitos verificadores no registro, além de
  formato e unicidade no banco.
- **Verificação de email:** não implementada agora (uso pessoal). O schema
  não precisa de coluna extra pra isso hoje — pode ser adicionado depois
  (`emailVerificadoEm` nullable) sem quebrar nada existente.
- **Política de senha:** mínimo 8 caracteres, sem exigência extra de
  complexidade.
- **Escopo:** backend (NestJS) + telas no app (Expo), ponta a ponta.

## Arquitetura (backend)

Novo `AuthModule` em `backend/src/auth/`, isolado do resto do domínio
financeiro:

```
backend/src/auth/
├── auth.module.ts
├── auth.controller.ts       # POST /auth/register, /login, /refresh, /logout, GET /auth/me
├── auth.service.ts          # hash/verify senha, emissão e validação de tokens
├── strategies/
│   └── jwt.strategy.ts      # passport-jwt, valida access token nas rotas protegidas
├── guards/
│   └── jwt-auth.guard.ts    # AuthGuard('jwt'), usado com @UseGuards
├── decorators/
│   └── current-user.decorator.ts  # extrai usuário do request via guard
└── dto/
    ├── register.dto.ts
    ├── login.dto.ts
    └── refresh.dto.ts
```

Sem `passport-local` (login é um método simples do `AuthService`, não precisa
de strategy dedicada). Sem `UsersModule` separado nesta etapa — `Usuario` é
gerenciado direto no `AuthService` via `PrismaService` já existente.

**Dependências novas:** `@nestjs/jwt`, `@nestjs/passport`, `passport`,
`passport-jwt`, `bcryptjs`, `class-validator`, `class-transformer`.

**Variáveis de ambiente novas** (`.env` / `.env.example`):
`JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES` (15m), `JWT_REFRESH_SECRET`,
`JWT_REFRESH_EXPIRES` (30d).

`ValidationPipe` global ativado (`whitelist: true, forbidNonWhitelisted:
true`) pra validar os DTOs via `class-validator`.

## Modelo de dados (schema.prisma)

Adiciona um model novo, sem alterar `Usuario` além da relação inversa:

```prisma
model RefreshToken {
  id          String    @id @default(uuid())
  usuarioId   String
  tokenHash   String    // hash bcrypt do refresh token (nunca o token cru)
  criadoEm    DateTime  @default(now())
  expiraEm    DateTime
  revogadoEm  DateTime?

  usuario Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)

  @@index([usuarioId])
  @@map("refresh_tokens")
}
```

Em `Usuario`, adiciona a relação inversa: `refreshTokens RefreshToken[]`.

O refresh token entregue ao cliente é um JWT assinado com
`JWT_REFRESH_SECRET`, payload `{ sub: usuarioId, jti: refreshTokenRecordId }`.
O hash bcrypt do JWT completo é guardado em `tokenHash` (defesa em
profundidade contra vazamento só do banco).

**Rotação e detecção de reuso:** a cada `/auth/refresh` bem-sucedido, o
registro usado é marcado `revogadoEm = now()` e um novo é criado. Se alguém
tentar reusar um refresh token cujo registro já está revogado (reuso =
possível roubo de sessão), **todos os refresh tokens daquele `usuarioId` são
revogados**, forçando novo login em todos os dispositivos.

Migration: `npx prisma migrate dev --name add_refresh_token`.

## Endpoints e DTOs

Todos sob `/auth`.

### `POST /auth/register`
```ts
class RegisterDto {
  @IsString() @IsNotEmpty() nome: string;
  @IsEmail() email: string;
  @IsCpf() cpf: string;        // validator customizado: formato + dígitos verificadores
  @IsString() @MinLength(8) senha: string;
}
```
- Verifica unicidade de `email`/`cpf` → `409 Conflict` (mensagem genérica).
- Hash da senha com `bcryptjs`, cria `Usuario`.
- Retorna `{ usuario: { id, nome, email, cpf }, accessToken, refreshToken }`
  (registro já loga automaticamente).

### `POST /auth/login`
```ts
class LoginDto {
  @IsEmail() email: string;
  @IsString() @IsNotEmpty() senha: string;
}
```
- Credencial inválida → `401` com mensagem genérica ("email ou senha
  inválidos", nunca aponta qual campo errou).
- Mesma resposta do register.

### `POST /auth/refresh`
```ts
class RefreshDto { @IsString() @IsNotEmpty() refreshToken: string; }
```
- Verifica assinatura/expiração do JWT → busca o registro por `jti` → se
  inválido/revogado, aplica a detecção de reuso descrita acima e retorna
  `401`.
- Se válido: revoga o token atual, emite novo par access+refresh.
- Retorna `{ accessToken, refreshToken }`.

### `POST /auth/logout`
Protegido por `JwtAuthGuard`. Recebe `{ refreshToken }` no corpo, marca
aquele registro como revogado. `204 No Content`.

### `GET /auth/me`
Protegido por `JwtAuthGuard`. Usa `@CurrentUser()` pra extrair o usuário do
payload do access token. Retorna `{ id, nome, email, cpf, criadoEm }`.

### Erros padronizados
- `400` — DTO inválido (campo faltando, CPF malformado)
- `409` — email ou CPF já cadastrado
- `401` — credenciais inválidas / token ausente, expirado ou revogado

## Frontend (Expo / expo-router)

Estrutura atual só tem telas placeholder (`index.tsx`, `explore.tsx`).
Proposta:

```
frontend/src/
├── lib/
│   ├── api.ts                # + apiPost, header Authorization automático, retry em 401
│   └── secure-storage.ts     # wrapper fino sobre expo-secure-store (guarda o refreshToken)
├── contexts/
│   └── AuthContext.tsx       # user, accessToken (memória), login(), register(), logout(), isLoading
└── app/
    ├── _layout.tsx           # envolve tudo em <AuthProvider>, redireciona (auth) x (app) conforme estado
    ├── (auth)/
    │   ├── login.tsx
    │   └── register.tsx
    └── (app)/                # index.tsx e explore.tsx atuais migram pra cá (grupo protegido)
```

**Armazenamento de tokens:** `accessToken` só em memória (state do
`AuthContext`) — nunca persiste, vida curta (15min). `refreshToken` persiste
em `expo-secure-store` (keychain/keystore criptografado do device). No boot
do app, `AuthProvider` lê o `refreshToken` salvo e, se existir, chama
`/auth/refresh` silenciosamente pra obter um `accessToken` novo — se falhar
(expirado/revogado), cai pra tela de login.

**Redirecionamento por grupo de rota:** `_layout.tsx` usa o padrão de auth do
`expo-router` (grupos `(auth)`/`(app)` + redirect condicional conforme
`isAuthenticated`/`isLoading`). Como o `AGENTS.md` do frontend avisa que a API
do Expo mudou nesta versão (v57), a implementação deve conferir a doc
versionada (https://docs.expo.dev/versions/v57.0.0/) antes de escrever esse
redirect, em vez de assumir um padrão antigo.

**`api.ts` estendido:** `apiPost<T>()` genérico, injeta `Authorization:
Bearer <accessToken>` quando setado. Se uma chamada autenticada voltar `401`,
tenta um `/auth/refresh` automático e repete a chamada uma vez antes de
deslogar o usuário.

**Telas:**
- `login.tsx`: email + senha, exibe erro genérico vindo do backend, link pra
  registro.
- `register.tsx`: nome, email, cpf, senha (+ confirmação client-side).
  Validação de formato é só cosmética — a fonte de verdade (duplicidade,
  dígito verificador do CPF) é sempre o backend.

**Biometria:** fora do escopo desta etapa (ver Decisões acima).

## Erros e testes

**Erros (backend → frontend):** o backend responde `400/401/409` +
`message`. O `AuthContext` traduz isso pra exibição na tela (ex: `409` no
registro → "email ou CPF já cadastrado"; `401` no login → "email ou senha
inválidos"). Nenhuma lógica de negócio duplicada no frontend.

**Testes backend (Jest):**
- Unit (`AuthService`): hash/verify de senha, geração/validação de access e
  refresh token, detecção de reuso de refresh token revogado (revoga todos),
  validador de CPF (`@IsCpf`) com casos válidos/inválidos conhecidos.
- E2E (supertest): fluxo completo register → login → me → refresh → logout,
  incluindo os casos de erro (email duplicado, credenciais erradas, refresh
  revogado).

**Testes frontend:** fora de escopo formal agora (projeto não tem test
runner configurado pro Expo ainda) — validação manual rodando o app.

## Fora de escopo (explicitamente adiado)

- Criação de `Workspace`/`Plano` no registro (onboarding separado).
- Verificação de email.
- Tela/toggle de biometria no app.
- Rate limiting em `/auth/login` (considerar numa passada de hardening
  antes do lançamento como SaaS).
