# Scaffold NestJS + Expo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the initial NestJS backend and Expo frontend for App-finance inside the existing `Sistema-finance` monorepo, wired together with npm workspaces and a shared package, with zero business logic.

**Architecture:** npm workspaces monorepo (`backend`, `frontend`, `shared`) at the repo root. Backend is a stock NestJS project with a global `PrismaModule`/`PrismaService` pointed at `backend/prisma/schema.prisma` (already committed). Frontend is a stock Expo Router project. `shared` is an empty-but-real npm package the other two depend on. Postgres runs locally via Docker Compose.

**Tech Stack:** NestJS 10/11 (TypeScript), Prisma ORM + PostgreSQL, Expo SDK (latest) with Expo Router, npm workspaces, Docker Compose.

## Global Constraints

- Package manager: npm only, using npm workspaces (`backend`, `frontend`, `shared`) — no pnpm/yarn.
- Scaffold via official generators (`@nestjs/cli new`, `create-expo-app`) — do not hand-write framework boilerplate.
- No NestJS domain modules yet (no `auth`, `usuarios`, `workspaces`, `transacoes`, `fiscal-pf`, `fiscal-pj`) — only the generated skeleton + Prisma wiring.
- No Expo business screens yet — only the generator's default placeholder route(s).
- `shared` package exists as a real npm package but exports only a placeholder — no real domain types yet.
- Local Postgres via Docker Compose, single container, named volume.
- No testing/CI beyond what the generators install by default (Jest).
- `backend/prisma/schema.prisma` already exists in the repo — never overwrite it during scaffolding.

---

### Task 1: Shared package skeleton

**Files:**
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/index.ts`
- Delete: `shared/.gitkeep`

**Interfaces:**
- Produces: npm package `@app-finance/shared`, exporting `SHARED_PACKAGE_NAME: string` from `shared/src/index.ts`. Consumed by Task 4 (workspace linking verification).

- [ ] **Step 1: Remove the placeholder file**

```bash
rm /home/marcosebia/Documentos/Dev/Sistema-finance/shared/.gitkeep
```

- [ ] **Step 2: Create `shared/package.json`**

```json
{
  "name": "@app-finance/shared",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 3: Create `shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `shared/src/index.ts`**

```typescript
// Placeholder export. Real shared types (DTOs, enums mirrored from Prisma,
// etc.) get added here once backend domain modules exist.
export const SHARED_PACKAGE_NAME = '@app-finance/shared';
```

- [ ] **Step 5: Verify the package type-checks**

Run: `npx --yes typescript@5.4.5 --version && npx --yes typescript@5.4.5 tsc --noEmit -p /home/marcosebia/Documentos/Dev/Sistema-finance/shared/tsconfig.json`

Expected: prints a `Version X.X.X` line, then exits 0 with no type errors printed.

- [ ] **Step 6: Commit**

```bash
cd /home/marcosebia/Documentos/Dev/Sistema-finance
git add shared/package.json shared/tsconfig.json shared/src/index.ts
git rm shared/.gitkeep
git commit -m "feat: scaffold shared package skeleton"
```

---

### Task 2: Scaffold NestJS backend

**Files:**
- Create (via generator, moved into place): `backend/src/app.module.ts`, `backend/src/app.controller.ts`, `backend/src/app.service.ts`, `backend/src/main.ts`, `backend/src/app.controller.spec.ts`, `backend/test/app.e2e-spec.ts`, `backend/test/jest-e2e.json`, `backend/package.json`, `backend/tsconfig.json`, `backend/tsconfig.build.json`, `backend/nest-cli.json`, `backend/eslint.config.mjs`, `backend/.prettierrc`
- Delete: `backend/src/.gitkeep`, `backend/tests/.gitkeep`, `backend/.gitignore` (generated; root `.gitignore` already covers it), the old empty `backend/tests/` dir is replaced by the generator's `backend/test/` dir
- Preserve untouched: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: `backend/package.json` with `"name": "backend"`, `npm run build` and `npm run start:dev` scripts (standard Nest CLI scripts). Consumed by Task 4 (workspace wiring) and Task 5 (Prisma integration).

- [ ] **Step 1: Remove placeholder files**

```bash
cd /home/marcosebia/Documentos/Dev/Sistema-finance
rm -f backend/src/.gitkeep backend/tests/.gitkeep
```

- [ ] **Step 2: Generate a fresh NestJS project into a temp folder**

```bash
npx --yes @nestjs/cli@latest new backend-scaffold-tmp --package-manager npm --skip-git --skip-install
```

Expected: exits 0, prints `🚀  Successfully created project backend-scaffold-tmp`, creates `backend-scaffold-tmp/` containing `src/`, `test/`, `package.json`, `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json`.

- [ ] **Step 3: Safety-strip any nested git repo, then merge into `backend/`**

```bash
rm -rf backend-scaffold-tmp/.git
cp -a backend-scaffold-tmp/. backend/
rm -rf backend-scaffold-tmp
rmdir backend/tests 2>/dev/null || true
rm -f backend/.gitignore
```

Expected: `ls backend` now shows `src/`, `test/`, `prisma/`, `package.json`, `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json`; `backend/prisma/schema.prisma` is unchanged (verify with `git status` showing no modification to that file).

- [ ] **Step 4: Rename the generated project name**

```bash
sed -i 's/"name": "backend-scaffold-tmp"/"name": "backend"/' backend/package.json
grep '"name": "backend"' backend/package.json
```

Expected: the grep prints `  "name": "backend",`.

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: scaffold NestJS backend via nest new"
```

---

### Task 3: Scaffold Expo frontend

**Files:**
- Create (via generator, moved into place): `frontend/app/` (Expo Router routes), `frontend/assets/` (icons/splash, replacing the placeholder), `frontend/package.json`, `frontend/app.json`, `frontend/tsconfig.json`
- Delete: `frontend/src/.gitkeep`, `frontend/assets/.gitkeep`, `frontend/.gitignore` (generated)
- Modify: `/.gitignore` (root) — add Expo-specific ignores

**Interfaces:**
- Produces: `frontend/package.json` with `"name": "frontend"` and Expo's standard `start`/`android`/`ios`/`web` scripts. Consumed by Task 4 (workspace wiring) and Task 6 (API client).

- [ ] **Step 1: Remove placeholder files**

```bash
cd /home/marcosebia/Documentos/Dev/Sistema-finance
rm -f frontend/src/.gitkeep frontend/assets/.gitkeep
```

- [ ] **Step 2: Generate a fresh Expo project into a temp folder**

```bash
npx --yes create-expo-app@latest frontend-scaffold-tmp --no-install
```

Expected: exits 0, creates `frontend-scaffold-tmp/` containing `app/`, `assets/`, `package.json`, `app.json`, `tsconfig.json`.

- [ ] **Step 3: Safety-strip any nested git repo, then merge into `frontend/`**

```bash
rm -rf frontend-scaffold-tmp/.git
cp -a frontend-scaffold-tmp/. frontend/
rm -rf frontend-scaffold-tmp
rmdir frontend/src 2>/dev/null || true
rm -f frontend/.gitignore
```

Expected: `ls frontend` shows `app/`, `assets/`, `package.json`, `app.json`, `tsconfig.json`.

- [ ] **Step 4: Rename the generated project name/slug**

```bash
sed -i 's/"name": "frontend-scaffold-tmp"/"name": "frontend"/' frontend/package.json
sed -i 's/"frontend-scaffold-tmp"/"frontend"/g' frontend/app.json
grep '"name": "frontend"' frontend/package.json
```

Expected: the grep prints `  "name": "frontend",`.

- [ ] **Step 5: Add Expo-specific entries to the root `.gitignore`**

Modify `/home/marcosebia/Documentos/Dev/Sistema-finance/.gitignore`, appending:

```
# Expo
.expo/
expo-env.d.ts
```

- [ ] **Step 6: Commit**

```bash
git add frontend/ .gitignore
git commit -m "feat: scaffold Expo frontend via create-expo-app"
```

---

### Task 4: Wire up npm workspaces + shared package linking

**Files:**
- Create: `/package.json` (root)
- Create: `frontend/metro.config.js`
- Modify: `backend/package.json` (add `@app-finance/shared` dependency)
- Modify: `frontend/package.json` (add `@app-finance/shared` dependency)

**Interfaces:**
- Consumes: `shared/package.json` (Task 1), `backend/package.json` (Task 2), `frontend/package.json` (Task 3).
- Produces: root-level `npm install` that hoists and symlinks all three workspaces; `frontend/metro.config.js` exporting a Metro config with `watchFolders`/`resolver.nodeModulesPaths` covering the monorepo root, consumed implicitly by `expo start`/`expo export` in any future task that bundles frontend code.

- [ ] **Step 1: Create the root `package.json`**

```json
{
  "name": "app-finance",
  "private": true,
  "workspaces": [
    "backend",
    "frontend",
    "shared"
  ],
  "scripts": {
    "dev:backend": "npm run start:dev -w backend",
    "dev:frontend": "npm run start -w frontend",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down"
  }
}
```

- [ ] **Step 2: Add `@app-finance/shared` as a dependency of backend and frontend**

```bash
cd /home/marcosebia/Documentos/Dev/Sistema-finance
node -e "
const fs = require('fs');
for (const pkgPath of ['backend/package.json', 'frontend/package.json']) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.dependencies = pkg.dependencies || {};
  pkg.dependencies['@app-finance/shared'] = '*';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}
"
grep '@app-finance/shared' backend/package.json frontend/package.json
```

Expected: both `grep` lines print `"@app-finance/shared": "*"`.

- [ ] **Step 3: Install from the root to link workspaces**

```bash
npm install
```

Expected: exits 0; creates root `node_modules/` and `package-lock.json`; `node_modules/@app-finance/shared` is a symlink to `../shared`.

- [ ] **Step 4: Verify the workspace link resolves from both backend and frontend**

```bash
node -e "console.log(require('./backend/node_modules/@app-finance/shared').SHARED_PACKAGE_NAME)" 2>/dev/null \
  || node -e "console.log(require('./node_modules/@app-finance/shared').SHARED_PACKAGE_NAME)"
```

Expected: prints `@app-finance/shared`.

- [ ] **Step 5: Verify the backend still builds**

```bash
npm run build -w backend
```

Expected: exits 0, prints Nest's webpack/tsc build success output, creates `backend/dist/`.

- [ ] **Step 6: Add `frontend/metro.config.js` for monorepo module resolution**

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
```

- [ ] **Step 7: Verify the Metro config loads correctly**

```bash
cd frontend && node -e "console.log(Object.keys(require('./metro.config.js')))" && cd ..
```

Expected: prints an array of config keys including `'resolver'`, `'transformer'`, `'watchFolders'`, with no thrown error.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json backend/package.json frontend/package.json frontend/metro.config.js
git commit -m "feat: wire npm workspaces and link shared package"
```

---

### Task 5: Integrate Prisma into the backend

**Files:**
- Create: `backend/src/prisma/prisma.service.ts`
- Create: `backend/src/prisma/prisma.module.ts`
- Create: `backend/.env`
- Modify: `backend/src/app.module.ts` (register `PrismaModule`)
- Modify: `backend/package.json` (add `prisma:generate`/`prisma:migrate` scripts)

**Interfaces:**
- Consumes: `backend/prisma/schema.prisma` (already in repo).
- Produces: `PrismaService` (injectable, extends `PrismaClient`, connects on `onModuleInit`/disconnects on `onModuleDestroy`) exported by `PrismaModule` at `backend/src/prisma/prisma.module.ts`, globally available to any future Nest module via constructor injection — `constructor(private readonly prisma: PrismaService) {}`.

- [ ] **Step 1: Install Prisma dependencies into the backend workspace**

```bash
cd /home/marcosebia/Documentos/Dev/Sistema-finance
npm install prisma @prisma/client -w backend
```

Expected: exits 0; `backend/package.json` now lists `prisma` (devDependencies) and `@prisma/client` (dependencies).

- [ ] **Step 2: Create `backend/src/prisma/prisma.service.ts`**

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 3: Create `backend/src/prisma/prisma.module.ts`**

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 4: Register `PrismaModule` in `backend/src/app.module.ts`**

Replace the file's contents with:

```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 5: Create `backend/.env`**

```
DATABASE_URL="postgresql://appfinance:appfinance@localhost:5432/appfinance?schema=public"
JWT_SECRET="dev-secret-change-me"
```

- [ ] **Step 6: Add Prisma scripts to `backend/package.json`**

```bash
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('backend/package.json', 'utf8'));
pkg.scripts['prisma:generate'] = 'prisma generate';
pkg.scripts['prisma:migrate'] = 'prisma migrate dev';
fs.writeFileSync('backend/package.json', JSON.stringify(pkg, null, 2) + '\n');
"
grep 'prisma:generate' backend/package.json
```

Expected: the grep prints the new script line.

- [ ] **Step 7: Generate the Prisma client and verify the backend still builds**

```bash
npm run prisma:generate -w backend
npm run build -w backend
```

Expected: `prisma:generate` prints `✔ Generated Prisma Client ...`; `build` exits 0 with no TypeScript errors (confirms `PrismaService`/`PrismaModule` compile and `PrismaClient` types exist).

- [ ] **Step 8: Commit**

```bash
git add backend/src/prisma backend/src/app.module.ts backend/package.json package-lock.json
git commit -m "feat: integrate Prisma into NestJS backend"
```

Note: `backend/.env` is intentionally not committed (already covered by root `.gitignore`'s `.env`/`.env.local` rules).

---

### Task 6: Frontend API client

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/.env`

**Interfaces:**
- Produces: `apiGet<T>(path: string): Promise<T>` from `frontend/src/lib/api.ts`, the single entry point future screens use to call the backend (e.g. `import { apiGet } from '@/lib/api'` — `frontend/tsconfig.json` maps `@/*` to `./src/*`, so the `src/` segment is not repeated in the import path).

- [ ] **Step 1: Create `frontend/src/lib/api.ts`**

```typescript
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`GET ${path} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}
```

- [ ] **Step 2: Create `frontend/.env`**

```
EXPO_PUBLIC_API_URL=http://localhost:3000
```

- [ ] **Step 3: Verify the file type-checks against the generated Expo project**

```bash
cd /home/marcosebia/Documentos/Dev/Sistema-finance/frontend
npx tsc --noEmit
cd ..
```

Expected: exits 0 with no errors (confirms `api.ts` compiles cleanly against the project's `tsconfig.json`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add frontend API client base"
```

Note: `frontend/.env` is not committed (covered by root `.gitignore`'s `.env` rule).

---

### Task 7: Docker Compose, env template, and end-to-end verification

**Files:**
- Create: `/docker-compose.yml`
- Create: `/.env.example`

**Interfaces:**
- Consumes: `backend/prisma/schema.prisma` (Task 5's target), `backend/.env` (Task 5).
- Produces: a running local Postgres reachable at `localhost:5432` with credentials matching `backend/.env`, used by any future `prisma migrate` command.

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: appfinance
      POSTGRES_PASSWORD: appfinance
      POSTGRES_DB: appfinance
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

- [ ] **Step 2: Create `.env.example`**

```
# Backend
DATABASE_URL="postgresql://appfinance:appfinance@localhost:5432/appfinance?schema=public"
JWT_SECRET="replace-with-a-long-random-value"

# Frontend
EXPO_PUBLIC_API_URL="http://localhost:3000"
```

- [ ] **Step 3: Start Postgres and confirm it's healthy**

```bash
docker compose up -d
docker compose ps
```

Expected: `postgres` service shows state `running` (or `healthy`).

- [ ] **Step 4: Run the first Prisma migration against the real database**

```bash
npm run prisma:migrate -w backend -- --name init
```

Expected: prints `Your database is now in sync with your schema.`, creates `backend/prisma/migrations/<timestamp>_init/migration.sql`.

- [ ] **Step 5: Tear down and bring the database back up to confirm the volume persists**

```bash
docker compose down
docker compose up -d
docker compose ps
```

Expected: `postgres` shows `running`/`healthy` again after restart.

- [ ] **Step 6: Final full verification pass**

```bash
npm run build -w backend
cd frontend && npx tsc --noEmit && cd ..
```

Expected: both commands exit 0 with no errors.

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml .env.example backend/prisma/migrations
git commit -m "feat: add Docker Compose Postgres, env template, and initial migration"
```

---

## Self-Review Notes

- **Spec coverage:** root workspace structure (Task 4), backend skeleton + Prisma (Task 2, 5), frontend skeleton + Expo Router (Task 3), shared package (Task 1), Docker Compose + `.env.example` (Task 7), root scripts (Task 4 step 1) — all spec sections have a task.
- **Explicitly out of scope, not tasked here** (matches spec's "Fora de escopo"): domain NestJS modules, business screens in Expo, Passenger/cPanel deploy config, CI, real shared types.
- **Type/name consistency checked:** `PrismaService`/`PrismaModule` names match between Task 5's creation and its `app.module.ts` registration; `apiGet` is the only export Task 6 promises and the only one it defines; `SHARED_PACKAGE_NAME` is the only export Task 1 promises and the only one Task 4's verification step reads.
