# Carnê-leão Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o carnê-leão (apuração mensal obrigatória de IR sobre renda autônoma sem retenção): lançamento de rendimentos, deduções e livro-caixa, cálculo automático da apuração mensal, e telas mobile completas.

**Architecture:** Um módulo backend `carne-leao` (5 services + 4 controllers, todos escopados por `usuarioId`, sem `WorkspaceGuard`) e uma nova aba mobile "Carnê-leão" com 4 telas (lista + 3 formulários modais).

**Tech Stack:** NestJS + Prisma (backend, models já existentes no schema), Expo/expo-router + React Native (frontend), Jest (testes).

## Global Constraints

- Todos os models (`RendimentoAutonomo`, `DeducaoCarneLeao`, `LivroCaixaLancamento`, `ApuracaoMensalCarneLeao`, `ParametroFiscalPF`) são escopados por `usuarioId`, nunca por `workspaceId` — nenhuma rota deste módulo usa `WorkspaceGuard`, só `JwtAuthGuard` + `@CurrentUser()`.
- Nenhuma migration de schema — todos os models já existem em `backend/prisma/schema.prisma`.
- `usuarioId` sempre vem do `CurrentUser`, nunca do body.
- Editar/excluir um lançamento pertencente a outro usuário retorna `404` (não vaza que o lançamento existe).
- Livro-caixa é sempre somado automaticamente na apuração — nunca lançado manualmente como `DeducaoCarneLeao` (o DTO de dedução rejeita o tipo `LIVRO_CAIXA`).
- Desconto simplificado mensal é uma alternativa às deduções detalhadas, não soma com elas — a apuração usa `max(deducoesDetalhadasTotal, descontoSimplificadoMensal)`.
- Faixa de cálculo incerto: `faixaIsencaoMensal < baseCalculo <= faixaReducaoAte` → tabela progressiva sem redutor especial, `calculoIncerto = true`. Abaixo de `faixaIsencaoMensal` → isento. Acima de `faixaReducaoAte` → tabela progressiva normal, `calculoIncerto = false`.
- Vencimento = último dia do mês seguinte à competência, recuando para sexta-feira se cair em sábado/domingo — sem calendário de feriados.
- `ParametroFiscalPF` é lido por ano-calendário; se não existir, lança erro claro (`404`), nunca calcula com dados ausentes.
- **Task 11 (seed dos valores oficiais de 2026) está bloqueada** até o usuário fornecer os valores reais. Nenhuma outra task depende dela — todas as outras (incluindo o teste e2e da Task 10) criam seus próprios dados de `ParametroFiscalPF` de teste. Não inventar valores fiscais em nenhuma circunstância.
- Todos os comandos npm assumem execução a partir da raiz do repositório (`/home/marcosebia/Documentos/Dev/Sistema-finance`), usando `npm run <script> -w backend` (ou `-w frontend`).
- Ambiente local: Postgres do projeto roda na porta **5433**.
- Convenção de tipagem: os enums do Prisma (`TipoRendimentoAutonomo`, `TipoDeducaoCarneLeao`, `StatusApuracao`) são gerados como union types de string literais, não `enum` TypeScript — union types próprios (ex: `'INSS_AUTONOMO' | 'PENSAO_JUDICIAL' | 'PGBL'`) são diretamente atribuíveis a eles, sem cast.
- Se o frontend usar `router.push`/`useLocalSearchParams` para uma rota que ainda não existe como arquivo em `frontend/src/app/`, `tsc --noEmit` falha (rotas tipadas do expo-router são geradas a partir da estrutura de arquivos). Por isso as 3 telas modais (Tasks 14-16) são criadas **antes** da tela principal que as referencia (Task 17).

---

### Task 1: DTOs — `RendimentoAutonomo`

**Files:**
- Create: `backend/src/carne-leao/dto/create-rendimento-autonomo.dto.ts`
- Create: `backend/src/carne-leao/dto/update-rendimento-autonomo.dto.ts`
- Test: `backend/src/carne-leao/dto/create-rendimento-autonomo.dto.spec.ts`
- Test: `backend/src/carne-leao/dto/update-rendimento-autonomo.dto.spec.ts`

**Interfaces:**
- Consumes: `IsCpf` (`../../auth/validators/is-cpf.validator`, já existente), `TipoRendimentoAutonomo` (`@prisma/client`).
- Produces: `CreateRendimentoAutonomoDto`, `UpdateRendimentoAutonomoDto`.

- [ ] **Step 1: Escrever os testes**

```ts
// backend/src/carne-leao/dto/create-rendimento-autonomo.dto.spec.ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateRendimentoAutonomoDto } from './create-rendimento-autonomo.dto';

describe('CreateRendimentoAutonomoDto', () => {
  const valid = {
    tipo: 'HONORARIO',
    fontePagadoraCpf: '11144477735',
    valorBruto: 1500,
    competencia: '2026-07-01',
  };

  it('aceita um honorário válido', async () => {
    const dto = plainToInstance(CreateRendimentoAutonomoDto, valid);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('aceita rendimento do exterior sem fontePagadoraCpf', async () => {
    const dto = plainToInstance(CreateRendimentoAutonomoDto, {
      tipo: 'EXTERIOR',
      valorBruto: 2000,
      competencia: '2026-07-01',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejeita honorário sem fontePagadoraCpf', async () => {
    const dto = plainToInstance(CreateRendimentoAutonomoDto, {
      tipo: 'HONORARIO',
      valorBruto: 1500,
      competencia: '2026-07-01',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'fontePagadoraCpf')).toBe(true);
  });

  it('rejeita um fontePagadoraCpf inválido', async () => {
    const dto = plainToInstance(CreateRendimentoAutonomoDto, {
      ...valid,
      fontePagadoraCpf: '000.000.000-00',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'fontePagadoraCpf')).toBe(true);
  });

  it('rejeita um tipo inválido', async () => {
    const dto = plainToInstance(CreateRendimentoAutonomoDto, {
      ...valid,
      tipo: 'INVALIDO',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'tipo')).toBe(true);
  });

  it('rejeita um valorBruto não positivo', async () => {
    const dto = plainToInstance(CreateRendimentoAutonomoDto, {
      ...valid,
      valorBruto: -10,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'valorBruto')).toBe(true);
  });
});
```

```ts
// backend/src/carne-leao/dto/update-rendimento-autonomo.dto.spec.ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateRendimentoAutonomoDto } from './update-rendimento-autonomo.dto';

describe('UpdateRendimentoAutonomoDto', () => {
  it('aceita um objeto vazio (todos os campos opcionais)', async () => {
    const dto = plainToInstance(UpdateRendimentoAutonomoDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('aceita atualizar só o valorBruto', async () => {
    const dto = plainToInstance(UpdateRendimentoAutonomoDto, { valorBruto: 2000 });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejeita um fontePagadoraCpf inválido quando informado', async () => {
    const dto = plainToInstance(UpdateRendimentoAutonomoDto, {
      fontePagadoraCpf: '000.000.000-00',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'fontePagadoraCpf')).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm run test -w backend -- rendimento-autonomo.dto`
Expected: FAIL — `Cannot find module './create-rendimento-autonomo.dto'`.

- [ ] **Step 3: Implementar os DTOs**

```ts
// backend/src/carne-leao/dto/create-rendimento-autonomo.dto.ts
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { TipoRendimentoAutonomo } from '@prisma/client';
import { IsCpf } from '../../auth/validators/is-cpf.validator';

export class CreateRendimentoAutonomoDto {
  @IsEnum(TipoRendimentoAutonomo)
  tipo: TipoRendimentoAutonomo;

  @ValidateIf((o: CreateRendimentoAutonomoDto) => o.tipo !== 'EXTERIOR')
  @IsCpf()
  fontePagadoraCpf?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valorBruto: number;

  @IsOptional()
  @IsUUID()
  documentoFiscalId?: string;

  @IsDateString()
  competencia: string;
}
```

```ts
// backend/src/carne-leao/dto/update-rendimento-autonomo.dto.ts
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
} from 'class-validator';
import { TipoRendimentoAutonomo } from '@prisma/client';
import { IsCpf } from '../../auth/validators/is-cpf.validator';

export class UpdateRendimentoAutonomoDto {
  @IsOptional()
  @IsEnum(TipoRendimentoAutonomo)
  tipo?: TipoRendimentoAutonomo;

  @IsOptional()
  @IsCpf()
  fontePagadoraCpf?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valorBruto?: number;

  @IsOptional()
  @IsUUID()
  documentoFiscalId?: string;

  @IsOptional()
  @IsDateString()
  competencia?: string;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm run test -w backend -- rendimento-autonomo.dto`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/carne-leao/dto/create-rendimento-autonomo.dto.ts backend/src/carne-leao/dto/create-rendimento-autonomo.dto.spec.ts backend/src/carne-leao/dto/update-rendimento-autonomo.dto.ts backend/src/carne-leao/dto/update-rendimento-autonomo.dto.spec.ts
git commit -m "feat: adiciona CreateRendimentoAutonomoDto e UpdateRendimentoAutonomoDto"
```

---

### Task 2: DTOs — `DeducaoCarneLeao`

**Files:**
- Create: `backend/src/carne-leao/dto/create-deducao-carne-leao.dto.ts`
- Create: `backend/src/carne-leao/dto/update-deducao-carne-leao.dto.ts`
- Test: `backend/src/carne-leao/dto/create-deducao-carne-leao.dto.spec.ts`
- Test: `backend/src/carne-leao/dto/update-deducao-carne-leao.dto.spec.ts`

**Interfaces:**
- Produces: `CreateDeducaoCarneLeaoDto`, `UpdateDeducaoCarneLeaoDto`, `TipoDeducaoCarneLeaoAceito` (union `'INSS_AUTONOMO' | 'PENSAO_JUDICIAL' | 'PGBL'` — **não** inclui `'LIVRO_CAIXA'`), `TIPOS_DEDUCAO_ACEITOS`.

- [ ] **Step 1: Escrever os testes**

```ts
// backend/src/carne-leao/dto/create-deducao-carne-leao.dto.spec.ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateDeducaoCarneLeaoDto } from './create-deducao-carne-leao.dto';

describe('CreateDeducaoCarneLeaoDto', () => {
  const valid = {
    tipo: 'INSS_AUTONOMO',
    valor: 500,
    competencia: '2026-07-01',
  };

  it('aceita uma dedução INSS válida', async () => {
    const dto = plainToInstance(CreateDeducaoCarneLeaoDto, valid);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('aceita PGBL com anexoUrl', async () => {
    const dto = plainToInstance(CreateDeducaoCarneLeaoDto, {
      ...valid,
      tipo: 'PGBL',
      anexoUrl: 'https://exemplo.com/comprovante.pdf',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejeita o tipo LIVRO_CAIXA (a dedução de livro-caixa é sempre automática)', async () => {
    const dto = plainToInstance(CreateDeducaoCarneLeaoDto, {
      ...valid,
      tipo: 'LIVRO_CAIXA',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'tipo')).toBe(true);
  });

  it('rejeita um tipo desconhecido', async () => {
    const dto = plainToInstance(CreateDeducaoCarneLeaoDto, {
      ...valid,
      tipo: 'INVALIDO',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'tipo')).toBe(true);
  });

  it('rejeita um valor não positivo', async () => {
    const dto = plainToInstance(CreateDeducaoCarneLeaoDto, { ...valid, valor: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'valor')).toBe(true);
  });
});
```

```ts
// backend/src/carne-leao/dto/update-deducao-carne-leao.dto.spec.ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateDeducaoCarneLeaoDto } from './update-deducao-carne-leao.dto';

describe('UpdateDeducaoCarneLeaoDto', () => {
  it('aceita um objeto vazio', async () => {
    const dto = plainToInstance(UpdateDeducaoCarneLeaoDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejeita o tipo LIVRO_CAIXA quando informado', async () => {
    const dto = plainToInstance(UpdateDeducaoCarneLeaoDto, { tipo: 'LIVRO_CAIXA' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'tipo')).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm run test -w backend -- deducao-carne-leao.dto`
Expected: FAIL — `Cannot find module './create-deducao-carne-leao.dto'`.

- [ ] **Step 3: Implementar os DTOs**

```ts
// backend/src/carne-leao/dto/create-deducao-carne-leao.dto.ts
import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export type TipoDeducaoCarneLeaoAceito = 'INSS_AUTONOMO' | 'PENSAO_JUDICIAL' | 'PGBL';

export const TIPOS_DEDUCAO_ACEITOS: TipoDeducaoCarneLeaoAceito[] = [
  'INSS_AUTONOMO',
  'PENSAO_JUDICIAL',
  'PGBL',
];

export class CreateDeducaoCarneLeaoDto {
  @IsIn(TIPOS_DEDUCAO_ACEITOS)
  tipo: TipoDeducaoCarneLeaoAceito;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor: number;

  @IsOptional()
  @IsString()
  anexoUrl?: string;

  @IsDateString()
  competencia: string;
}
```

```ts
// backend/src/carne-leao/dto/update-deducao-carne-leao.dto.ts
import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { TIPOS_DEDUCAO_ACEITOS, TipoDeducaoCarneLeaoAceito } from './create-deducao-carne-leao.dto';

export class UpdateDeducaoCarneLeaoDto {
  @IsOptional()
  @IsIn(TIPOS_DEDUCAO_ACEITOS)
  tipo?: TipoDeducaoCarneLeaoAceito;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor?: number;

  @IsOptional()
  @IsString()
  anexoUrl?: string;

  @IsOptional()
  @IsDateString()
  competencia?: string;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm run test -w backend -- deducao-carne-leao.dto`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/carne-leao/dto/create-deducao-carne-leao.dto.ts backend/src/carne-leao/dto/create-deducao-carne-leao.dto.spec.ts backend/src/carne-leao/dto/update-deducao-carne-leao.dto.ts backend/src/carne-leao/dto/update-deducao-carne-leao.dto.spec.ts
git commit -m "feat: adiciona CreateDeducaoCarneLeaoDto e UpdateDeducaoCarneLeaoDto"
```

---

### Task 3: DTOs — `LivroCaixaLancamento`

**Files:**
- Create: `backend/src/carne-leao/dto/create-livro-caixa.dto.ts`
- Create: `backend/src/carne-leao/dto/update-livro-caixa.dto.ts`
- Test: `backend/src/carne-leao/dto/create-livro-caixa.dto.spec.ts`
- Test: `backend/src/carne-leao/dto/update-livro-caixa.dto.spec.ts`

**Interfaces:**
- Produces: `CreateLivroCaixaDto`, `UpdateLivroCaixaDto`.

- [ ] **Step 1: Escrever os testes**

```ts
// backend/src/carne-leao/dto/create-livro-caixa.dto.spec.ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateLivroCaixaDto } from './create-livro-caixa.dto';

describe('CreateLivroCaixaDto', () => {
  const valid = {
    descricao: 'aluguel do escritório',
    categoria: 'aluguel_escritorio',
    valor: 300,
    competencia: '2026-07-01',
  };

  it('aceita um lançamento válido', async () => {
    const dto = plainToInstance(CreateLivroCaixaDto, valid);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejeita descricao vazia', async () => {
    const dto = plainToInstance(CreateLivroCaixaDto, { ...valid, descricao: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'descricao')).toBe(true);
  });

  it('rejeita categoria vazia', async () => {
    const dto = plainToInstance(CreateLivroCaixaDto, { ...valid, categoria: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'categoria')).toBe(true);
  });

  it('rejeita um valor não positivo', async () => {
    const dto = plainToInstance(CreateLivroCaixaDto, { ...valid, valor: -1 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'valor')).toBe(true);
  });
});
```

```ts
// backend/src/carne-leao/dto/update-livro-caixa.dto.spec.ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateLivroCaixaDto } from './update-livro-caixa.dto';

describe('UpdateLivroCaixaDto', () => {
  it('aceita um objeto vazio', async () => {
    const dto = plainToInstance(UpdateLivroCaixaDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('aceita atualizar só o valor', async () => {
    const dto = plainToInstance(UpdateLivroCaixaDto, { valor: 400 });
    expect(await validate(dto)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm run test -w backend -- livro-caixa.dto`
Expected: FAIL — `Cannot find module './create-livro-caixa.dto'`.

- [ ] **Step 3: Implementar os DTOs**

```ts
// backend/src/carne-leao/dto/create-livro-caixa.dto.ts
import { IsDateString, IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class CreateLivroCaixaDto {
  @IsString()
  @IsNotEmpty()
  descricao: string;

  @IsString()
  @IsNotEmpty()
  categoria: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor: number;

  @IsDateString()
  competencia: string;
}
```

```ts
// backend/src/carne-leao/dto/update-livro-caixa.dto.ts
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class UpdateLivroCaixaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  descricao?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoria?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor?: number;

  @IsOptional()
  @IsDateString()
  competencia?: string;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm run test -w backend -- livro-caixa.dto`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/carne-leao/dto/create-livro-caixa.dto.ts backend/src/carne-leao/dto/create-livro-caixa.dto.spec.ts backend/src/carne-leao/dto/update-livro-caixa.dto.ts backend/src/carne-leao/dto/update-livro-caixa.dto.spec.ts
git commit -m "feat: adiciona CreateLivroCaixaDto e UpdateLivroCaixaDto"
```

---

### Task 4: `ParametroFiscalPfService`

**Files:**
- Create: `backend/src/carne-leao/parametro-fiscal-pf.service.ts`
- Test: `backend/src/carne-leao/parametro-fiscal-pf.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (`../prisma/prisma.service`).
- Produces: `FaixaProgressiva { ate: number; aliquota: number; parcelaDeduzir: number }`, `ParametroFiscalPfDados` (os 6 campos numéricos + `tabelaProgressivaMensal`, sem `anoCalendario`), `ParametroFiscalPfResult extends ParametroFiscalPfDados` (com `anoCalendario`), `ParametroFiscalPfService.ensureSeed(ano: number, dados: ParametroFiscalPfDados): Promise<void>` (idempotente — não sobrescreve se já existir), `ParametroFiscalPfService.buscarPorAno(ano: number): Promise<ParametroFiscalPfResult>` (lança `NotFoundException` se não existir).

Este service é genérico — não conhece "2026" nem valores reais. Os valores oficiais entram via `ensureSeed`, chamado por outra peça (Task 11).

- [ ] **Step 1: Escrever o teste**

```ts
// backend/src/carne-leao/parametro-fiscal-pf.service.spec.ts
import { NotFoundException } from '@nestjs/common';
import { ParametroFiscalPfService, ParametroFiscalPfDados } from './parametro-fiscal-pf.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ParametroFiscalPfService', () => {
  const dadosTeste: ParametroFiscalPfDados = {
    faixaIsencaoMensal: 2000,
    faixaReducaoAte: 3000,
    tetoEducacaoAnual: 3561.5,
    valorDependenteMensal: 189.59,
    descontoSimplificadoMensal: 500,
    limiteObrigatoriedadeDeclaracao: 35584,
    tabelaProgressivaMensal: [{ ate: 999999999, aliquota: 0.2, parcelaDeduzir: 400 }],
  };

  const buildService = () => {
    const prisma = {
      parametroFiscalPF: { findUnique: jest.fn(), create: jest.fn() },
    } as unknown as PrismaService;
    return { service: new ParametroFiscalPfService(prisma), prisma };
  };

  describe('ensureSeed', () => {
    it('cria o parâmetro quando não existe ainda para o ano', async () => {
      const { service, prisma } = buildService();
      (prisma.parametroFiscalPF.findUnique as jest.Mock).mockResolvedValue(null);

      await service.ensureSeed(2026, dadosTeste);

      expect(prisma.parametroFiscalPF.create).toHaveBeenCalledWith({
        data: { anoCalendario: 2026, ...dadosTeste },
      });
    });

    it('não recria o parâmetro quando já existe para o ano (idempotente)', async () => {
      const { service, prisma } = buildService();
      (prisma.parametroFiscalPF.findUnique as jest.Mock).mockResolvedValue({
        anoCalendario: 2026,
      });

      await service.ensureSeed(2026, dadosTeste);

      expect(prisma.parametroFiscalPF.create).not.toHaveBeenCalled();
    });
  });

  describe('buscarPorAno', () => {
    it('retorna o parâmetro convertido para number quando existe', async () => {
      const { service, prisma } = buildService();
      (prisma.parametroFiscalPF.findUnique as jest.Mock).mockResolvedValue({
        anoCalendario: 2026,
        faixaIsencaoMensal: '2000',
        faixaReducaoAte: '3000',
        tetoEducacaoAnual: '3561.5',
        valorDependenteMensal: '189.59',
        descontoSimplificadoMensal: '500',
        limiteObrigatoriedadeDeclaracao: '35584',
        tabelaProgressivaMensal: dadosTeste.tabelaProgressivaMensal,
      });

      const result = await service.buscarPorAno(2026);

      expect(result.faixaIsencaoMensal).toBe(2000);
      expect(typeof result.faixaIsencaoMensal).toBe('number');
      expect(result.tabelaProgressivaMensal).toEqual(dadosTeste.tabelaProgressivaMensal);
    });

    it('lança NotFoundException quando o ano não está cadastrado', async () => {
      const { service, prisma } = buildService();
      (prisma.parametroFiscalPF.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.buscarPorAno(2099)).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test -w backend -- parametro-fiscal-pf.service`
Expected: FAIL — `Cannot find module './parametro-fiscal-pf.service'`.

- [ ] **Step 3: Implementar**

```ts
// backend/src/carne-leao/parametro-fiscal-pf.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface FaixaProgressiva {
  ate: number;
  aliquota: number;
  parcelaDeduzir: number;
}

export interface ParametroFiscalPfDados {
  faixaIsencaoMensal: number;
  faixaReducaoAte: number;
  tetoEducacaoAnual: number;
  valorDependenteMensal: number;
  descontoSimplificadoMensal: number;
  limiteObrigatoriedadeDeclaracao: number;
  tabelaProgressivaMensal: FaixaProgressiva[];
}

export interface ParametroFiscalPfResult extends ParametroFiscalPfDados {
  anoCalendario: number;
}

interface RawParametroFiscalPf {
  anoCalendario: number;
  faixaIsencaoMensal: unknown;
  faixaReducaoAte: unknown;
  tetoEducacaoAnual: unknown;
  valorDependenteMensal: unknown;
  descontoSimplificadoMensal: unknown;
  limiteObrigatoriedadeDeclaracao: unknown;
  tabelaProgressivaMensal: unknown;
}

@Injectable()
export class ParametroFiscalPfService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureSeed(ano: number, dados: ParametroFiscalPfDados): Promise<void> {
    const existente = await this.prisma.parametroFiscalPF.findUnique({
      where: { anoCalendario: ano },
    });
    if (existente) {
      return;
    }
    await this.prisma.parametroFiscalPF.create({
      data: { anoCalendario: ano, ...dados },
    });
  }

  async buscarPorAno(ano: number): Promise<ParametroFiscalPfResult> {
    const parametro = await this.prisma.parametroFiscalPF.findUnique({
      where: { anoCalendario: ano },
    });
    if (!parametro) {
      throw new NotFoundException(`parâmetro fiscal do ano ${ano} não cadastrado`);
    }
    return this.toResult(parametro);
  }

  private toResult(parametro: RawParametroFiscalPf): ParametroFiscalPfResult {
    return {
      anoCalendario: parametro.anoCalendario,
      faixaIsencaoMensal: Number(parametro.faixaIsencaoMensal),
      faixaReducaoAte: Number(parametro.faixaReducaoAte),
      tetoEducacaoAnual: Number(parametro.tetoEducacaoAnual),
      valorDependenteMensal: Number(parametro.valorDependenteMensal),
      descontoSimplificadoMensal: Number(parametro.descontoSimplificadoMensal),
      limiteObrigatoriedadeDeclaracao: Number(parametro.limiteObrigatoriedadeDeclaracao),
      tabelaProgressivaMensal: parametro.tabelaProgressivaMensal as unknown as FaixaProgressiva[],
    };
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test -w backend -- parametro-fiscal-pf.service`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/carne-leao/parametro-fiscal-pf.service.ts backend/src/carne-leao/parametro-fiscal-pf.service.spec.ts
git commit -m "feat: adiciona ParametroFiscalPfService"
```

---

### Task 5: `ApuracaoCarneLeaoService`

**Files:**
- Create: `backend/src/carne-leao/apuracao-carne-leao.service.ts`
- Test: `backend/src/carne-leao/apuracao-carne-leao.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `ParametroFiscalPfService.buscarPorAno` (Task 4).
- Produces: `ApuracaoCarneLeaoResult { id, competencia: Date, rendimentoBrutoTotal: number, deducoesTotal: number, baseCalculo: number, aliquotaEfetiva: number, impostoDevido: number, codigoReceita: string, vencimento: Date, status: StatusApuracao, calculoIncerto: boolean }`, `ApuracaoCarneLeaoService.recalcular(usuarioId: string, competencia: Date): Promise<ApuracaoCarneLeaoResult>`, `ApuracaoCarneLeaoService.buscarPorMes(usuarioId: string, ano: number, mes: number): Promise<ApuracaoCarneLeaoResult | null>`.

**Valores usados nos testes abaixo são ilustrativos, não os valores oficiais de 2026.**

- [ ] **Step 1: Escrever o teste**

```ts
// backend/src/carne-leao/apuracao-carne-leao.service.spec.ts
import { BadRequestException } from '@nestjs/common';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';
import { PrismaService } from '../prisma/prisma.service';
import { ParametroFiscalPfService } from './parametro-fiscal-pf.service';

describe('ApuracaoCarneLeaoService', () => {
  const usuarioId = 'user-1';

  // Valores de teste ilustrativos — não são os valores oficiais de 2026.
  const parametroTeste = {
    anoCalendario: 2026,
    faixaIsencaoMensal: 2000,
    faixaReducaoAte: 3000,
    tetoEducacaoAnual: 3561.5,
    valorDependenteMensal: 189.59,
    descontoSimplificadoMensal: 500,
    limiteObrigatoriedadeDeclaracao: 35584,
    tabelaProgressivaMensal: [
      { ate: 2000, aliquota: 0, parcelaDeduzir: 0 },
      { ate: 3000, aliquota: 0.1, parcelaDeduzir: 100 },
      { ate: 999999999, aliquota: 0.2, parcelaDeduzir: 400 },
    ],
  };

  const buildService = () => {
    const prisma = {
      rendimentoAutonomo: { findMany: jest.fn().mockResolvedValue([]) },
      deducaoCarneLeao: { findMany: jest.fn().mockResolvedValue([]) },
      livroCaixaLancamento: { findMany: jest.fn().mockResolvedValue([]) },
      apuracaoMensalCarneLeao: {
        upsert: jest.fn(({ create }: { create: unknown }) => ({ id: 'ap-1', ...(create as object) })),
        findUnique: jest.fn(),
      },
    } as unknown as PrismaService;

    const parametroFiscalPfService = {
      buscarPorAno: jest.fn().mockResolvedValue(parametroTeste),
    } as unknown as ParametroFiscalPfService;

    return {
      service: new ApuracaoCarneLeaoService(prisma, parametroFiscalPfService),
      prisma,
      parametroFiscalPfService,
    };
  };

  describe('recalcular', () => {
    it('isento quando a base de cálculo não passa a faixa de isenção', async () => {
      const { service, prisma } = buildService();
      (prisma.rendimentoAutonomo.findMany as jest.Mock).mockResolvedValue([{ valorBruto: '1500' }]);

      const result = await service.recalcular(usuarioId, new Date('2026-01-15'));

      expect(result.baseCalculo).toBe(1000); // 1500 - max(0, 500)
      expect(result.impostoDevido).toBe(0);
      expect(result.calculoIncerto).toBe(false);
    });

    it('aplica a tabela sem redutor e marca calculoIncerto na faixa 2000-3000', async () => {
      const { service, prisma } = buildService();
      (prisma.rendimentoAutonomo.findMany as jest.Mock).mockResolvedValue([{ valorBruto: '3000' }]);
      (prisma.deducaoCarneLeao.findMany as jest.Mock).mockResolvedValue([{ valor: '200' }]);

      const result = await service.recalcular(usuarioId, new Date('2026-01-15'));

      expect(result.baseCalculo).toBe(2500); // 3000 - max(200, 500)
      expect(result.impostoDevido).toBe(150); // 2500*0.10 - 100
      expect(result.calculoIncerto).toBe(true);
    });

    it('usa a dedução detalhada quando ela é maior que o desconto simplificado', async () => {
      const { service, prisma } = buildService();
      (prisma.rendimentoAutonomo.findMany as jest.Mock).mockResolvedValue([{ valorBruto: '6000' }]);
      (prisma.deducaoCarneLeao.findMany as jest.Mock).mockResolvedValue([{ valor: '1000' }]);

      const result = await service.recalcular(usuarioId, new Date('2026-01-15'));

      expect(result.baseCalculo).toBe(5000); // 6000 - max(1000, 500)
      expect(result.impostoDevido).toBe(600); // 5000*0.20 - 400
      expect(result.calculoIncerto).toBe(false);
    });

    it('usa o desconto simplificado quando as deduções detalhadas são menores', async () => {
      const { service, prisma } = buildService();
      (prisma.rendimentoAutonomo.findMany as jest.Mock).mockResolvedValue([{ valorBruto: '6000' }]);
      (prisma.deducaoCarneLeao.findMany as jest.Mock).mockResolvedValue([{ valor: '200' }]);

      const result = await service.recalcular(usuarioId, new Date('2026-01-15'));

      expect(result.baseCalculo).toBe(5500); // 6000 - max(200, 500)
      expect(result.impostoDevido).toBe(700); // 5500*0.20 - 400
    });

    it('soma os lançamentos de livro-caixa na dedução detalhada', async () => {
      const { service, prisma } = buildService();
      (prisma.rendimentoAutonomo.findMany as jest.Mock).mockResolvedValue([{ valorBruto: '6000' }]);
      (prisma.deducaoCarneLeao.findMany as jest.Mock).mockResolvedValue([{ valor: '100' }]);
      (prisma.livroCaixaLancamento.findMany as jest.Mock).mockResolvedValue([{ valor: '700' }]);

      const result = await service.recalcular(usuarioId, new Date('2026-01-15'));

      expect(result.baseCalculo).toBe(5200); // 6000 - max(100+700, 500)
      expect(result.impostoDevido).toBe(640); // 5200*0.20 - 400
    });

    it('recua o vencimento de sábado para sexta-feira', async () => {
      const { service } = buildService();

      const result = await service.recalcular(usuarioId, new Date('2026-01-15'));

      // competência janeiro/2026 -> vencimento seria 28/02/2026 (sábado) -> recua para 27/02/2026
      expect(result.vencimento.toISOString().slice(0, 10)).toBe('2026-02-27');
    });

    it('recua o vencimento de domingo para sexta-feira', async () => {
      const { service } = buildService();

      const result = await service.recalcular(usuarioId, new Date('2026-04-15'));

      // competência abril/2026 -> vencimento seria 31/05/2026 (domingo) -> recua para 29/05/2026
      expect(result.vencimento.toISOString().slice(0, 10)).toBe('2026-05-29');
    });

    it('mantém o vencimento quando já cai em dia útil', async () => {
      const { service } = buildService();

      const result = await service.recalcular(usuarioId, new Date('2026-06-15'));

      // competência junho/2026 -> vencimento 31/07/2026 (sexta-feira) -> sem recuo
      expect(result.vencimento.toISOString().slice(0, 10)).toBe('2026-07-31');
    });

    it('propaga o erro quando o parâmetro fiscal do ano não existe', async () => {
      const { service, parametroFiscalPfService } = buildService();
      (parametroFiscalPfService.buscarPorAno as jest.Mock).mockRejectedValue(
        new Error('parâmetro fiscal do ano 2099 não cadastrado'),
      );

      await expect(service.recalcular(usuarioId, new Date('2099-01-15'))).rejects.toThrow(
        'parâmetro fiscal do ano 2099 não cadastrado',
      );
    });
  });

  describe('buscarPorMes', () => {
    it('retorna null quando não existe apuração para o mês', async () => {
      const { service, prisma } = buildService();
      (prisma.apuracaoMensalCarneLeao.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.buscarPorMes(usuarioId, 2026, 7);

      expect(result).toBeNull();
    });

    it('rejeita um mes fora do intervalo 1-12', async () => {
      const { service } = buildService();

      await expect(service.buscarPorMes(usuarioId, 2026, 13)).rejects.toThrow(BadRequestException);
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test -w backend -- apuracao-carne-leao.service`
Expected: FAIL — `Cannot find module './apuracao-carne-leao.service'`.

- [ ] **Step 3: Implementar**

```ts
// backend/src/carne-leao/apuracao-carne-leao.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { StatusApuracao } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ParametroFiscalPfService, FaixaProgressiva } from './parametro-fiscal-pf.service';

export interface ApuracaoCarneLeaoResult {
  id: string;
  competencia: Date;
  rendimentoBrutoTotal: number;
  deducoesTotal: number;
  baseCalculo: number;
  aliquotaEfetiva: number;
  impostoDevido: number;
  codigoReceita: string;
  vencimento: Date;
  status: StatusApuracao;
  calculoIncerto: boolean;
}

interface RawApuracao {
  id: string;
  competencia: Date;
  rendimentoBrutoTotal: unknown;
  deducoesTotal: unknown;
  baseCalculo: unknown;
  aliquotaEfetiva: unknown;
  impostoDevido: unknown;
  codigoReceita: string;
  vencimento: Date;
  status: StatusApuracao;
  calculoIncerto: boolean;
}

@Injectable()
export class ApuracaoCarneLeaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametroFiscalPfService: ParametroFiscalPfService,
  ) {}

  async recalcular(usuarioId: string, competencia: Date): Promise<ApuracaoCarneLeaoResult> {
    const inicioMes = new Date(
      Date.UTC(competencia.getUTCFullYear(), competencia.getUTCMonth(), 1),
    );

    const [rendimentos, deducoes, livroCaixaLancamentos, parametro] = await Promise.all([
      this.prisma.rendimentoAutonomo.findMany({ where: { usuarioId, competencia: inicioMes } }),
      this.prisma.deducaoCarneLeao.findMany({ where: { usuarioId, competencia: inicioMes } }),
      this.prisma.livroCaixaLancamento.findMany({ where: { usuarioId, competencia: inicioMes } }),
      this.parametroFiscalPfService.buscarPorAno(inicioMes.getUTCFullYear()),
    ]);

    const rendimentoBrutoTotal = rendimentos.reduce(
      (total, r) => total + Number(r.valorBruto),
      0,
    );
    const deducoesDetalhadasTotal =
      deducoes.reduce((total, d) => total + Number(d.valor), 0) +
      livroCaixaLancamentos.reduce((total, l) => total + Number(l.valor), 0);

    const deducoesTotal = Math.max(deducoesDetalhadasTotal, parametro.descontoSimplificadoMensal);
    const baseCalculo = Math.max(0, rendimentoBrutoTotal - deducoesTotal);

    let impostoDevido = 0;
    let calculoIncerto = false;

    if (baseCalculo > parametro.faixaIsencaoMensal) {
      const faixa =
        parametro.tabelaProgressivaMensal.find((f: FaixaProgressiva) => baseCalculo <= f.ate) ??
        parametro.tabelaProgressivaMensal[parametro.tabelaProgressivaMensal.length - 1];
      impostoDevido = Math.max(0, baseCalculo * faixa.aliquota - faixa.parcelaDeduzir);
      calculoIncerto = baseCalculo <= parametro.faixaReducaoAte;
    }

    const aliquotaEfetiva = baseCalculo > 0 ? impostoDevido / baseCalculo : 0;
    const vencimento = this.calcularVencimento(inicioMes);

    const apuracao = await this.prisma.apuracaoMensalCarneLeao.upsert({
      where: { usuarioId_competencia: { usuarioId, competencia: inicioMes } },
      create: {
        usuarioId,
        competencia: inicioMes,
        rendimentoBrutoTotal,
        deducoesTotal,
        baseCalculo,
        aliquotaEfetiva,
        impostoDevido,
        vencimento,
        calculoIncerto,
        status: StatusApuracao.PENDENTE,
      },
      update: {
        rendimentoBrutoTotal,
        deducoesTotal,
        baseCalculo,
        aliquotaEfetiva,
        impostoDevido,
        vencimento,
        calculoIncerto,
      },
    });

    return this.toResult(apuracao);
  }

  async buscarPorMes(
    usuarioId: string,
    ano: number,
    mes: number,
  ): Promise<ApuracaoCarneLeaoResult | null> {
    if (mes < 1 || mes > 12) {
      throw new BadRequestException('mes deve estar entre 1 e 12');
    }
    const competencia = new Date(Date.UTC(ano, mes - 1, 1));
    const apuracao = await this.prisma.apuracaoMensalCarneLeao.findUnique({
      where: { usuarioId_competencia: { usuarioId, competencia } },
    });
    return apuracao ? this.toResult(apuracao) : null;
  }

  private calcularVencimento(competencia: Date): Date {
    const ano = competencia.getUTCFullYear();
    const mes = competencia.getUTCMonth();
    const vencimento = new Date(Date.UTC(ano, mes + 2, 0)); // último dia do mês seguinte
    const diaSemana = vencimento.getUTCDay(); // 0=domingo .. 6=sábado
    if (diaSemana === 0) {
      vencimento.setUTCDate(vencimento.getUTCDate() - 2);
    } else if (diaSemana === 6) {
      vencimento.setUTCDate(vencimento.getUTCDate() - 1);
    }
    return vencimento;
  }

  private toResult(apuracao: RawApuracao): ApuracaoCarneLeaoResult {
    return {
      id: apuracao.id,
      competencia: apuracao.competencia,
      rendimentoBrutoTotal: Number(apuracao.rendimentoBrutoTotal),
      deducoesTotal: Number(apuracao.deducoesTotal),
      baseCalculo: Number(apuracao.baseCalculo),
      aliquotaEfetiva: Number(apuracao.aliquotaEfetiva),
      impostoDevido: Number(apuracao.impostoDevido),
      codigoReceita: apuracao.codigoReceita,
      vencimento: apuracao.vencimento,
      status: apuracao.status,
      calculoIncerto: apuracao.calculoIncerto,
    };
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test -w backend -- apuracao-carne-leao.service`
Expected: PASS (11 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/carne-leao/apuracao-carne-leao.service.ts backend/src/carne-leao/apuracao-carne-leao.service.spec.ts
git commit -m "feat: adiciona ApuracaoCarneLeaoService"
```

---

### Task 6: `RendimentoAutonomoService`

**Files:**
- Create: `backend/src/carne-leao/rendimento-autonomo.service.ts`
- Test: `backend/src/carne-leao/rendimento-autonomo.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `ApuracaoCarneLeaoService.recalcular` (Task 5), `CreateRendimentoAutonomoDto`/`UpdateRendimentoAutonomoDto` (Task 1).
- Produces: `RendimentoAutonomoResult { id, tipo, fontePagadoraCpf: string | null, valorBruto: number, documentoFiscalId: string | null, competencia: Date }`, `RendimentoAutonomoService.create(usuarioId, dto)`, `.findByMonth(usuarioId, ano, mes)`, `.update(usuarioId, id, dto)`, `.delete(usuarioId, id)`.

- [ ] **Step 1: Escrever o teste**

```ts
// backend/src/carne-leao/rendimento-autonomo.service.spec.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RendimentoAutonomoService } from './rendimento-autonomo.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';

describe('RendimentoAutonomoService', () => {
  const usuarioId = 'user-1';

  const buildService = () => {
    const prisma = {
      rendimentoAutonomo: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as PrismaService;

    const apuracaoService = {
      recalcular: jest.fn(),
    } as unknown as ApuracaoCarneLeaoService;

    return { service: new RendimentoAutonomoService(prisma, apuracaoService), prisma, apuracaoService };
  };

  describe('create', () => {
    it('cria um rendimento e recalcula a apuração da competência', async () => {
      const { service, prisma, apuracaoService } = buildService();
      (prisma.rendimentoAutonomo.create as jest.Mock).mockResolvedValue({
        id: 'r-1',
        tipo: 'HONORARIO',
        fontePagadoraCpf: '11144477735',
        valorBruto: '1500',
        documentoFiscalId: null,
        competencia: new Date(Date.UTC(2026, 6, 1)),
      });

      const result = await service.create(usuarioId, {
        tipo: 'HONORARIO',
        fontePagadoraCpf: '11144477735',
        valorBruto: 1500,
        competencia: '2026-07-15',
      });

      expect(prisma.rendimentoAutonomo.create).toHaveBeenCalledWith({
        data: {
          usuarioId,
          tipo: 'HONORARIO',
          fontePagadoraCpf: '11144477735',
          valorBruto: 1500,
          documentoFiscalId: undefined,
          competencia: new Date(Date.UTC(2026, 6, 1)),
        },
      });
      expect(apuracaoService.recalcular).toHaveBeenCalledWith(
        usuarioId,
        new Date(Date.UTC(2026, 6, 1)),
      );
      expect(result.valorBruto).toBe(1500);
    });
  });

  describe('findByMonth', () => {
    it('rejeita um mes fora do intervalo 1-12', async () => {
      const { service } = buildService();
      await expect(service.findByMonth(usuarioId, 2026, 0)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('atualiza um rendimento próprio e recalcula a apuração', async () => {
      const { service, prisma, apuracaoService } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (prisma.rendimentoAutonomo.findUnique as jest.Mock).mockResolvedValue({
        id: 'r-1',
        usuarioId,
        competencia,
      });
      (prisma.rendimentoAutonomo.update as jest.Mock).mockResolvedValue({
        id: 'r-1',
        tipo: 'HONORARIO',
        fontePagadoraCpf: '11144477735',
        valorBruto: '2000',
        documentoFiscalId: null,
        competencia,
      });

      const result = await service.update(usuarioId, 'r-1', { valorBruto: 2000 });

      expect(prisma.rendimentoAutonomo.update).toHaveBeenCalledWith({
        where: { id: 'r-1' },
        data: { valorBruto: 2000 },
      });
      expect(apuracaoService.recalcular).toHaveBeenCalledWith(usuarioId, competencia);
      expect(result.valorBruto).toBe(2000);
    });

    it('lança NotFoundException ao editar rendimento de outro usuário', async () => {
      const { service, prisma } = buildService();
      (prisma.rendimentoAutonomo.findUnique as jest.Mock).mockResolvedValue({
        id: 'r-1',
        usuarioId: 'outro-usuario',
        competencia: new Date(),
      });

      await expect(
        service.update(usuarioId, 'r-1', { valorBruto: 2000 }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.rendimentoAutonomo.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('exclui um rendimento próprio e recalcula a apuração', async () => {
      const { service, prisma, apuracaoService } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (prisma.rendimentoAutonomo.findUnique as jest.Mock).mockResolvedValue({
        id: 'r-1',
        usuarioId,
        competencia,
      });

      await service.delete(usuarioId, 'r-1');

      expect(prisma.rendimentoAutonomo.delete).toHaveBeenCalledWith({ where: { id: 'r-1' } });
      expect(apuracaoService.recalcular).toHaveBeenCalledWith(usuarioId, competencia);
    });

    it('lança NotFoundException ao excluir rendimento de outro usuário', async () => {
      const { service, prisma } = buildService();
      (prisma.rendimentoAutonomo.findUnique as jest.Mock).mockResolvedValue({
        id: 'r-1',
        usuarioId: 'outro-usuario',
        competencia: new Date(),
      });

      await expect(service.delete(usuarioId, 'r-1')).rejects.toThrow(NotFoundException);
      expect(prisma.rendimentoAutonomo.delete).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test -w backend -- rendimento-autonomo.service`
Expected: FAIL — `Cannot find module './rendimento-autonomo.service'`.

- [ ] **Step 3: Implementar**

```ts
// backend/src/carne-leao/rendimento-autonomo.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TipoRendimentoAutonomo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';
import { CreateRendimentoAutonomoDto } from './dto/create-rendimento-autonomo.dto';
import { UpdateRendimentoAutonomoDto } from './dto/update-rendimento-autonomo.dto';

export interface RendimentoAutonomoResult {
  id: string;
  tipo: TipoRendimentoAutonomo;
  fontePagadoraCpf: string | null;
  valorBruto: number;
  documentoFiscalId: string | null;
  competencia: Date;
}

interface RawRendimento {
  id: string;
  tipo: TipoRendimentoAutonomo;
  fontePagadoraCpf: string | null;
  valorBruto: unknown;
  documentoFiscalId: string | null;
  competencia: Date;
  usuarioId: string;
}

@Injectable()
export class RendimentoAutonomoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apuracaoService: ApuracaoCarneLeaoService,
  ) {}

  async create(
    usuarioId: string,
    dto: CreateRendimentoAutonomoDto,
  ): Promise<RendimentoAutonomoResult> {
    const competencia = this.inicioMes(dto.competencia);
    const rendimento = await this.prisma.rendimentoAutonomo.create({
      data: {
        usuarioId,
        tipo: dto.tipo,
        fontePagadoraCpf: dto.fontePagadoraCpf,
        valorBruto: dto.valorBruto,
        documentoFiscalId: dto.documentoFiscalId,
        competencia,
      },
    });
    await this.apuracaoService.recalcular(usuarioId, competencia);
    return this.toResult(rendimento);
  }

  async findByMonth(
    usuarioId: string,
    ano: number,
    mes: number,
  ): Promise<RendimentoAutonomoResult[]> {
    if (mes < 1 || mes > 12) {
      throw new BadRequestException('mes deve estar entre 1 e 12');
    }
    const competencia = new Date(Date.UTC(ano, mes - 1, 1));
    const rendimentos = await this.prisma.rendimentoAutonomo.findMany({
      where: { usuarioId, competencia },
    });
    return rendimentos.map((r) => this.toResult(r));
  }

  async update(
    usuarioId: string,
    id: string,
    dto: UpdateRendimentoAutonomoDto,
  ): Promise<RendimentoAutonomoResult> {
    const existente = await this.findOwned(usuarioId, id);

    const rendimento = await this.prisma.rendimentoAutonomo.update({
      where: { id },
      data: {
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        ...(dto.fontePagadoraCpf !== undefined && { fontePagadoraCpf: dto.fontePagadoraCpf }),
        ...(dto.valorBruto !== undefined && { valorBruto: dto.valorBruto }),
        ...(dto.documentoFiscalId !== undefined && { documentoFiscalId: dto.documentoFiscalId }),
        ...(dto.competencia !== undefined && { competencia: this.inicioMes(dto.competencia) }),
      },
    });

    await this.apuracaoService.recalcular(usuarioId, existente.competencia);
    if (dto.competencia !== undefined) {
      const novaCompetencia = this.inicioMes(dto.competencia);
      if (novaCompetencia.getTime() !== existente.competencia.getTime()) {
        await this.apuracaoService.recalcular(usuarioId, novaCompetencia);
      }
    }

    return this.toResult(rendimento);
  }

  async delete(usuarioId: string, id: string): Promise<void> {
    const existente = await this.findOwned(usuarioId, id);
    await this.prisma.rendimentoAutonomo.delete({ where: { id } });
    await this.apuracaoService.recalcular(usuarioId, existente.competencia);
  }

  private async findOwned(
    usuarioId: string,
    id: string,
  ): Promise<{ id: string; usuarioId: string; competencia: Date }> {
    const rendimento = await this.prisma.rendimentoAutonomo.findUnique({ where: { id } });
    if (!rendimento || rendimento.usuarioId !== usuarioId) {
      throw new NotFoundException('rendimento não encontrado');
    }
    return rendimento;
  }

  private inicioMes(data: string): Date {
    const d = new Date(data);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }

  private toResult(rendimento: RawRendimento): RendimentoAutonomoResult {
    return {
      id: rendimento.id,
      tipo: rendimento.tipo,
      fontePagadoraCpf: rendimento.fontePagadoraCpf,
      valorBruto: Number(rendimento.valorBruto),
      documentoFiscalId: rendimento.documentoFiscalId,
      competencia: rendimento.competencia,
    };
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test -w backend -- rendimento-autonomo.service`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/carne-leao/rendimento-autonomo.service.ts backend/src/carne-leao/rendimento-autonomo.service.spec.ts
git commit -m "feat: adiciona RendimentoAutonomoService"
```

---

### Task 7: `DeducaoCarneLeaoService`

**Files:**
- Create: `backend/src/carne-leao/deducao-carne-leao.service.ts`
- Test: `backend/src/carne-leao/deducao-carne-leao.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `ApuracaoCarneLeaoService.recalcular` (Task 5), `CreateDeducaoCarneLeaoDto`/`UpdateDeducaoCarneLeaoDto` (Task 2).
- Produces: `DeducaoCarneLeaoResult { id, tipo: TipoDeducaoCarneLeaoAceito, valor: number, anexoUrl: string | null, competencia: Date }`, `DeducaoCarneLeaoService.create/findByMonth/update/delete` (mesma assinatura de `RendimentoAutonomoService`).

- [ ] **Step 1: Escrever o teste**

```ts
// backend/src/carne-leao/deducao-carne-leao.service.spec.ts
import { NotFoundException } from '@nestjs/common';
import { DeducaoCarneLeaoService } from './deducao-carne-leao.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';

describe('DeducaoCarneLeaoService', () => {
  const usuarioId = 'user-1';

  const buildService = () => {
    const prisma = {
      deducaoCarneLeao: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as PrismaService;

    const apuracaoService = { recalcular: jest.fn() } as unknown as ApuracaoCarneLeaoService;

    return { service: new DeducaoCarneLeaoService(prisma, apuracaoService), prisma, apuracaoService };
  };

  describe('create', () => {
    it('cria uma dedução e recalcula a apuração da competência', async () => {
      const { service, prisma, apuracaoService } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (prisma.deducaoCarneLeao.create as jest.Mock).mockResolvedValue({
        id: 'd-1',
        tipo: 'INSS_AUTONOMO',
        valor: '500',
        anexoUrl: null,
        competencia,
      });

      const result = await service.create(usuarioId, {
        tipo: 'INSS_AUTONOMO',
        valor: 500,
        competencia: '2026-07-15',
      });

      expect(prisma.deducaoCarneLeao.create).toHaveBeenCalledWith({
        data: { usuarioId, tipo: 'INSS_AUTONOMO', valor: 500, anexoUrl: undefined, competencia },
      });
      expect(apuracaoService.recalcular).toHaveBeenCalledWith(usuarioId, competencia);
      expect(result.valor).toBe(500);
    });
  });

  describe('update', () => {
    it('lança NotFoundException ao editar dedução de outro usuário', async () => {
      const { service, prisma } = buildService();
      (prisma.deducaoCarneLeao.findUnique as jest.Mock).mockResolvedValue({
        id: 'd-1',
        usuarioId: 'outro-usuario',
        competencia: new Date(),
      });

      await expect(service.update(usuarioId, 'd-1', { valor: 600 })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.deducaoCarneLeao.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('exclui uma dedução própria e recalcula a apuração', async () => {
      const { service, prisma, apuracaoService } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (prisma.deducaoCarneLeao.findUnique as jest.Mock).mockResolvedValue({
        id: 'd-1',
        usuarioId,
        competencia,
      });

      await service.delete(usuarioId, 'd-1');

      expect(prisma.deducaoCarneLeao.delete).toHaveBeenCalledWith({ where: { id: 'd-1' } });
      expect(apuracaoService.recalcular).toHaveBeenCalledWith(usuarioId, competencia);
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test -w backend -- deducao-carne-leao.service`
Expected: FAIL — `Cannot find module './deducao-carne-leao.service'`.

- [ ] **Step 3: Implementar**

```ts
// backend/src/carne-leao/deducao-carne-leao.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';
import { CreateDeducaoCarneLeaoDto, TipoDeducaoCarneLeaoAceito } from './dto/create-deducao-carne-leao.dto';
import { UpdateDeducaoCarneLeaoDto } from './dto/update-deducao-carne-leao.dto';

export interface DeducaoCarneLeaoResult {
  id: string;
  tipo: TipoDeducaoCarneLeaoAceito;
  valor: number;
  anexoUrl: string | null;
  competencia: Date;
}

interface RawDeducao {
  id: string;
  tipo: string;
  valor: unknown;
  anexoUrl: string | null;
  competencia: Date;
  usuarioId: string;
}

@Injectable()
export class DeducaoCarneLeaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apuracaoService: ApuracaoCarneLeaoService,
  ) {}

  async create(usuarioId: string, dto: CreateDeducaoCarneLeaoDto): Promise<DeducaoCarneLeaoResult> {
    const competencia = this.inicioMes(dto.competencia);
    const deducao = await this.prisma.deducaoCarneLeao.create({
      data: {
        usuarioId,
        tipo: dto.tipo,
        valor: dto.valor,
        anexoUrl: dto.anexoUrl,
        competencia,
      },
    });
    await this.apuracaoService.recalcular(usuarioId, competencia);
    return this.toResult(deducao);
  }

  async findByMonth(usuarioId: string, ano: number, mes: number): Promise<DeducaoCarneLeaoResult[]> {
    if (mes < 1 || mes > 12) {
      throw new BadRequestException('mes deve estar entre 1 e 12');
    }
    const competencia = new Date(Date.UTC(ano, mes - 1, 1));
    const deducoes = await this.prisma.deducaoCarneLeao.findMany({
      where: { usuarioId, competencia },
    });
    return deducoes.map((d) => this.toResult(d));
  }

  async update(
    usuarioId: string,
    id: string,
    dto: UpdateDeducaoCarneLeaoDto,
  ): Promise<DeducaoCarneLeaoResult> {
    const existente = await this.findOwned(usuarioId, id);

    const deducao = await this.prisma.deducaoCarneLeao.update({
      where: { id },
      data: {
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        ...(dto.valor !== undefined && { valor: dto.valor }),
        ...(dto.anexoUrl !== undefined && { anexoUrl: dto.anexoUrl }),
        ...(dto.competencia !== undefined && { competencia: this.inicioMes(dto.competencia) }),
      },
    });

    await this.apuracaoService.recalcular(usuarioId, existente.competencia);
    if (dto.competencia !== undefined) {
      const novaCompetencia = this.inicioMes(dto.competencia);
      if (novaCompetencia.getTime() !== existente.competencia.getTime()) {
        await this.apuracaoService.recalcular(usuarioId, novaCompetencia);
      }
    }

    return this.toResult(deducao);
  }

  async delete(usuarioId: string, id: string): Promise<void> {
    const existente = await this.findOwned(usuarioId, id);
    await this.prisma.deducaoCarneLeao.delete({ where: { id } });
    await this.apuracaoService.recalcular(usuarioId, existente.competencia);
  }

  private async findOwned(
    usuarioId: string,
    id: string,
  ): Promise<{ id: string; usuarioId: string; competencia: Date }> {
    const deducao = await this.prisma.deducaoCarneLeao.findUnique({ where: { id } });
    if (!deducao || deducao.usuarioId !== usuarioId) {
      throw new NotFoundException('dedução não encontrada');
    }
    return deducao;
  }

  private inicioMes(data: string): Date {
    const d = new Date(data);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }

  private toResult(deducao: RawDeducao): DeducaoCarneLeaoResult {
    return {
      id: deducao.id,
      tipo: deducao.tipo as TipoDeducaoCarneLeaoAceito,
      valor: Number(deducao.valor),
      anexoUrl: deducao.anexoUrl,
      competencia: deducao.competencia,
    };
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test -w backend -- deducao-carne-leao.service`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/carne-leao/deducao-carne-leao.service.ts backend/src/carne-leao/deducao-carne-leao.service.spec.ts
git commit -m "feat: adiciona DeducaoCarneLeaoService"
```

---

### Task 8: `LivroCaixaService`

**Files:**
- Create: `backend/src/carne-leao/livro-caixa.service.ts`
- Test: `backend/src/carne-leao/livro-caixa.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `ApuracaoCarneLeaoService.recalcular` (Task 5), `CreateLivroCaixaDto`/`UpdateLivroCaixaDto` (Task 3).
- Produces: `LivroCaixaResult { id, descricao: string, categoria: string, valor: number, competencia: Date }`, `LivroCaixaService.create/findByMonth/update/delete`.

- [ ] **Step 1: Escrever o teste**

```ts
// backend/src/carne-leao/livro-caixa.service.spec.ts
import { NotFoundException } from '@nestjs/common';
import { LivroCaixaService } from './livro-caixa.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';

describe('LivroCaixaService', () => {
  const usuarioId = 'user-1';

  const buildService = () => {
    const prisma = {
      livroCaixaLancamento: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as PrismaService;

    const apuracaoService = { recalcular: jest.fn() } as unknown as ApuracaoCarneLeaoService;

    return { service: new LivroCaixaService(prisma, apuracaoService), prisma, apuracaoService };
  };

  describe('create', () => {
    it('cria um lançamento e recalcula a apuração da competência', async () => {
      const { service, prisma, apuracaoService } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (prisma.livroCaixaLancamento.create as jest.Mock).mockResolvedValue({
        id: 'lc-1',
        descricao: 'aluguel do escritório',
        categoria: 'aluguel_escritorio',
        valor: '300',
        competencia,
      });

      const result = await service.create(usuarioId, {
        descricao: 'aluguel do escritório',
        categoria: 'aluguel_escritorio',
        valor: 300,
        competencia: '2026-07-15',
      });

      expect(prisma.livroCaixaLancamento.create).toHaveBeenCalledWith({
        data: {
          usuarioId,
          descricao: 'aluguel do escritório',
          categoria: 'aluguel_escritorio',
          valor: 300,
          competencia,
        },
      });
      expect(apuracaoService.recalcular).toHaveBeenCalledWith(usuarioId, competencia);
      expect(result.valor).toBe(300);
    });
  });

  describe('update', () => {
    it('lança NotFoundException ao editar lançamento de outro usuário', async () => {
      const { service, prisma } = buildService();
      (prisma.livroCaixaLancamento.findUnique as jest.Mock).mockResolvedValue({
        id: 'lc-1',
        usuarioId: 'outro-usuario',
        competencia: new Date(),
      });

      await expect(service.update(usuarioId, 'lc-1', { valor: 400 })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.livroCaixaLancamento.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('exclui um lançamento próprio e recalcula a apuração', async () => {
      const { service, prisma, apuracaoService } = buildService();
      const competencia = new Date(Date.UTC(2026, 6, 1));
      (prisma.livroCaixaLancamento.findUnique as jest.Mock).mockResolvedValue({
        id: 'lc-1',
        usuarioId,
        competencia,
      });

      await service.delete(usuarioId, 'lc-1');

      expect(prisma.livroCaixaLancamento.delete).toHaveBeenCalledWith({ where: { id: 'lc-1' } });
      expect(apuracaoService.recalcular).toHaveBeenCalledWith(usuarioId, competencia);
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test -w backend -- livro-caixa.service`
Expected: FAIL — `Cannot find module './livro-caixa.service'`.

- [ ] **Step 3: Implementar**

```ts
// backend/src/carne-leao/livro-caixa.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';
import { CreateLivroCaixaDto } from './dto/create-livro-caixa.dto';
import { UpdateLivroCaixaDto } from './dto/update-livro-caixa.dto';

export interface LivroCaixaResult {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  competencia: Date;
}

interface RawLivroCaixa {
  id: string;
  descricao: string;
  categoria: string;
  valor: unknown;
  competencia: Date;
  usuarioId: string;
}

@Injectable()
export class LivroCaixaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apuracaoService: ApuracaoCarneLeaoService,
  ) {}

  async create(usuarioId: string, dto: CreateLivroCaixaDto): Promise<LivroCaixaResult> {
    const competencia = this.inicioMes(dto.competencia);
    const lancamento = await this.prisma.livroCaixaLancamento.create({
      data: {
        usuarioId,
        descricao: dto.descricao,
        categoria: dto.categoria,
        valor: dto.valor,
        competencia,
      },
    });
    await this.apuracaoService.recalcular(usuarioId, competencia);
    return this.toResult(lancamento);
  }

  async findByMonth(usuarioId: string, ano: number, mes: number): Promise<LivroCaixaResult[]> {
    if (mes < 1 || mes > 12) {
      throw new BadRequestException('mes deve estar entre 1 e 12');
    }
    const competencia = new Date(Date.UTC(ano, mes - 1, 1));
    const lancamentos = await this.prisma.livroCaixaLancamento.findMany({
      where: { usuarioId, competencia },
    });
    return lancamentos.map((l) => this.toResult(l));
  }

  async update(
    usuarioId: string,
    id: string,
    dto: UpdateLivroCaixaDto,
  ): Promise<LivroCaixaResult> {
    const existente = await this.findOwned(usuarioId, id);

    const lancamento = await this.prisma.livroCaixaLancamento.update({
      where: { id },
      data: {
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.categoria !== undefined && { categoria: dto.categoria }),
        ...(dto.valor !== undefined && { valor: dto.valor }),
        ...(dto.competencia !== undefined && { competencia: this.inicioMes(dto.competencia) }),
      },
    });

    await this.apuracaoService.recalcular(usuarioId, existente.competencia);
    if (dto.competencia !== undefined) {
      const novaCompetencia = this.inicioMes(dto.competencia);
      if (novaCompetencia.getTime() !== existente.competencia.getTime()) {
        await this.apuracaoService.recalcular(usuarioId, novaCompetencia);
      }
    }

    return this.toResult(lancamento);
  }

  async delete(usuarioId: string, id: string): Promise<void> {
    const existente = await this.findOwned(usuarioId, id);
    await this.prisma.livroCaixaLancamento.delete({ where: { id } });
    await this.apuracaoService.recalcular(usuarioId, existente.competencia);
  }

  private async findOwned(
    usuarioId: string,
    id: string,
  ): Promise<{ id: string; usuarioId: string; competencia: Date }> {
    const lancamento = await this.prisma.livroCaixaLancamento.findUnique({ where: { id } });
    if (!lancamento || lancamento.usuarioId !== usuarioId) {
      throw new NotFoundException('lançamento de livro-caixa não encontrado');
    }
    return lancamento;
  }

  private inicioMes(data: string): Date {
    const d = new Date(data);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }

  private toResult(lancamento: RawLivroCaixa): LivroCaixaResult {
    return {
      id: lancamento.id,
      descricao: lancamento.descricao,
      categoria: lancamento.categoria,
      valor: Number(lancamento.valor),
      competencia: lancamento.competencia,
    };
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test -w backend -- livro-caixa.service`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/carne-leao/livro-caixa.service.ts backend/src/carne-leao/livro-caixa.service.spec.ts
git commit -m "feat: adiciona LivroCaixaService"
```

---

### Task 9: Controllers + `CarneLeaoModule` + integração no `AppModule`

**Files:**
- Create: `backend/src/carne-leao/rendimento-autonomo.controller.ts` + `.spec.ts`
- Create: `backend/src/carne-leao/deducao-carne-leao.controller.ts` + `.spec.ts`
- Create: `backend/src/carne-leao/livro-caixa.controller.ts` + `.spec.ts`
- Create: `backend/src/carne-leao/apuracao-carne-leao.controller.ts` + `.spec.ts`
- Create: `backend/src/carne-leao/carne-leao.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: os 4 services (Tasks 4-8), `JwtAuthGuard`, `CurrentUser`.
- Produces: rotas `POST/GET/PATCH/DELETE /rendimentos-autonomos`, `POST/GET/PATCH/DELETE /deducoes-carne-leao`, `POST/GET/PATCH/DELETE /livro-caixa`, `GET /apuracoes-carne-leao`.

- [ ] **Step 1: Escrever os testes dos controllers**

```ts
// backend/src/carne-leao/rendimento-autonomo.controller.spec.ts
import { RendimentoAutonomoController } from './rendimento-autonomo.controller';
import { RendimentoAutonomoService } from './rendimento-autonomo.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('RendimentoAutonomoController', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    nome: 'Marcos',
    email: 'marcos@example.com',
    cpf: '11144477735',
    criadoEm: new Date(),
  };

  const buildController = () => {
    const service = {
      create: jest.fn(),
      findByMonth: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as RendimentoAutonomoService;
    return { controller: new RendimentoAutonomoController(service), service };
  };

  it('delegates create com o usuário atual', async () => {
    const { controller, service } = buildController();
    const dto = { tipo: 'HONORARIO' as const, fontePagadoraCpf: '11144477735', valorBruto: 1500, competencia: '2026-07-15' };
    (service.create as jest.Mock).mockResolvedValue({ id: 'r-1' });

    await controller.create(dto, user);

    expect(service.create).toHaveBeenCalledWith(user.id, dto);
  });

  it('delegates findByMonth com o usuário atual', async () => {
    const { controller, service } = buildController();
    (service.findByMonth as jest.Mock).mockResolvedValue([]);

    await controller.findByMonth(2026, 7, user);

    expect(service.findByMonth).toHaveBeenCalledWith(user.id, 2026, 7);
  });

  it('delegates update com o usuário atual', async () => {
    const { controller, service } = buildController();
    (service.update as jest.Mock).mockResolvedValue({ id: 'r-1' });

    await controller.update('r-1', { valorBruto: 2000 }, user);

    expect(service.update).toHaveBeenCalledWith(user.id, 'r-1', { valorBruto: 2000 });
  });

  it('delegates delete com o usuário atual', async () => {
    const { controller, service } = buildController();
    (service.delete as jest.Mock).mockResolvedValue(undefined);

    await controller.delete('r-1', user);

    expect(service.delete).toHaveBeenCalledWith(user.id, 'r-1');
  });
});
```

```ts
// backend/src/carne-leao/deducao-carne-leao.controller.spec.ts
import { DeducaoCarneLeaoController } from './deducao-carne-leao.controller';
import { DeducaoCarneLeaoService } from './deducao-carne-leao.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('DeducaoCarneLeaoController', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    nome: 'Marcos',
    email: 'marcos@example.com',
    cpf: '11144477735',
    criadoEm: new Date(),
  };

  const buildController = () => {
    const service = {
      create: jest.fn(),
      findByMonth: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as DeducaoCarneLeaoService;
    return { controller: new DeducaoCarneLeaoController(service), service };
  };

  it('delegates create com o usuário atual', async () => {
    const { controller, service } = buildController();
    const dto = { tipo: 'INSS_AUTONOMO' as const, valor: 500, competencia: '2026-07-15' };
    (service.create as jest.Mock).mockResolvedValue({ id: 'd-1' });

    await controller.create(dto, user);

    expect(service.create).toHaveBeenCalledWith(user.id, dto);
  });

  it('delegates delete com o usuário atual', async () => {
    const { controller, service } = buildController();
    (service.delete as jest.Mock).mockResolvedValue(undefined);

    await controller.delete('d-1', user);

    expect(service.delete).toHaveBeenCalledWith(user.id, 'd-1');
  });
});
```

```ts
// backend/src/carne-leao/livro-caixa.controller.spec.ts
import { LivroCaixaController } from './livro-caixa.controller';
import { LivroCaixaService } from './livro-caixa.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('LivroCaixaController', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    nome: 'Marcos',
    email: 'marcos@example.com',
    cpf: '11144477735',
    criadoEm: new Date(),
  };

  const buildController = () => {
    const service = {
      create: jest.fn(),
      findByMonth: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as LivroCaixaService;
    return { controller: new LivroCaixaController(service), service };
  };

  it('delegates create com o usuário atual', async () => {
    const { controller, service } = buildController();
    const dto = { descricao: 'material', categoria: 'material', valor: 100, competencia: '2026-07-15' };
    (service.create as jest.Mock).mockResolvedValue({ id: 'lc-1' });

    await controller.create(dto, user);

    expect(service.create).toHaveBeenCalledWith(user.id, dto);
  });

  it('delegates delete com o usuário atual', async () => {
    const { controller, service } = buildController();
    (service.delete as jest.Mock).mockResolvedValue(undefined);

    await controller.delete('lc-1', user);

    expect(service.delete).toHaveBeenCalledWith(user.id, 'lc-1');
  });
});
```

```ts
// backend/src/carne-leao/apuracao-carne-leao.controller.spec.ts
import { ApuracaoCarneLeaoController } from './apuracao-carne-leao.controller';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('ApuracaoCarneLeaoController', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    nome: 'Marcos',
    email: 'marcos@example.com',
    cpf: '11144477735',
    criadoEm: new Date(),
  };

  it('delegates buscarPorMes com o usuário atual', async () => {
    const service = { buscarPorMes: jest.fn().mockResolvedValue(null) } as unknown as ApuracaoCarneLeaoService;
    const controller = new ApuracaoCarneLeaoController(service);

    await controller.buscarPorMes(2026, 7, user);

    expect(service.buscarPorMes).toHaveBeenCalledWith(user.id, 2026, 7);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm run test -w backend -- carne-leao`
Expected: FAIL — `Cannot find module './rendimento-autonomo.controller'` (e demais).

- [ ] **Step 3: Implementar os controllers**

```ts
// backend/src/carne-leao/rendimento-autonomo.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateRendimentoAutonomoDto } from './dto/create-rendimento-autonomo.dto';
import { UpdateRendimentoAutonomoDto } from './dto/update-rendimento-autonomo.dto';
import type { RendimentoAutonomoResult } from './rendimento-autonomo.service';
import { RendimentoAutonomoService } from './rendimento-autonomo.service';

@Controller('rendimentos-autonomos')
@UseGuards(JwtAuthGuard)
export class RendimentoAutonomoController {
  constructor(private readonly service: RendimentoAutonomoService) {}

  @Post()
  create(
    @Body() dto: CreateRendimentoAutonomoDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RendimentoAutonomoResult> {
    return this.service.create(user.id, dto);
  }

  @Get()
  findByMonth(
    @Query('ano', ParseIntPipe) ano: number,
    @Query('mes', ParseIntPipe) mes: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RendimentoAutonomoResult[]> {
    return this.service.findByMonth(user.id, ano, mes);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRendimentoAutonomoDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RendimentoAutonomoResult> {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.service.delete(user.id, id);
  }
}
```

```ts
// backend/src/carne-leao/deducao-carne-leao.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateDeducaoCarneLeaoDto } from './dto/create-deducao-carne-leao.dto';
import { UpdateDeducaoCarneLeaoDto } from './dto/update-deducao-carne-leao.dto';
import type { DeducaoCarneLeaoResult } from './deducao-carne-leao.service';
import { DeducaoCarneLeaoService } from './deducao-carne-leao.service';

@Controller('deducoes-carne-leao')
@UseGuards(JwtAuthGuard)
export class DeducaoCarneLeaoController {
  constructor(private readonly service: DeducaoCarneLeaoService) {}

  @Post()
  create(
    @Body() dto: CreateDeducaoCarneLeaoDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DeducaoCarneLeaoResult> {
    return this.service.create(user.id, dto);
  }

  @Get()
  findByMonth(
    @Query('ano', ParseIntPipe) ano: number,
    @Query('mes', ParseIntPipe) mes: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DeducaoCarneLeaoResult[]> {
    return this.service.findByMonth(user.id, ano, mes);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDeducaoCarneLeaoDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DeducaoCarneLeaoResult> {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.service.delete(user.id, id);
  }
}
```

```ts
// backend/src/carne-leao/livro-caixa.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateLivroCaixaDto } from './dto/create-livro-caixa.dto';
import { UpdateLivroCaixaDto } from './dto/update-livro-caixa.dto';
import type { LivroCaixaResult } from './livro-caixa.service';
import { LivroCaixaService } from './livro-caixa.service';

@Controller('livro-caixa')
@UseGuards(JwtAuthGuard)
export class LivroCaixaController {
  constructor(private readonly service: LivroCaixaService) {}

  @Post()
  create(
    @Body() dto: CreateLivroCaixaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LivroCaixaResult> {
    return this.service.create(user.id, dto);
  }

  @Get()
  findByMonth(
    @Query('ano', ParseIntPipe) ano: number,
    @Query('mes', ParseIntPipe) mes: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LivroCaixaResult[]> {
    return this.service.findByMonth(user.id, ano, mes);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLivroCaixaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LivroCaixaResult> {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.service.delete(user.id, id);
  }
}
```

```ts
// backend/src/carne-leao/apuracao-carne-leao.controller.ts
import { Controller, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import type { ApuracaoCarneLeaoResult } from './apuracao-carne-leao.service';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';

@Controller('apuracoes-carne-leao')
@UseGuards(JwtAuthGuard)
export class ApuracaoCarneLeaoController {
  constructor(private readonly service: ApuracaoCarneLeaoService) {}

  @Get()
  buscarPorMes(
    @Query('ano', ParseIntPipe) ano: number,
    @Query('mes', ParseIntPipe) mes: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApuracaoCarneLeaoResult | null> {
    return this.service.buscarPorMes(user.id, ano, mes);
  }
}
```

- [ ] **Step 4: Criar o módulo e integrar no `AppModule`**

```ts
// backend/src/carne-leao/carne-leao.module.ts
import { Module } from '@nestjs/common';
import { RendimentoAutonomoController } from './rendimento-autonomo.controller';
import { RendimentoAutonomoService } from './rendimento-autonomo.service';
import { DeducaoCarneLeaoController } from './deducao-carne-leao.controller';
import { DeducaoCarneLeaoService } from './deducao-carne-leao.service';
import { LivroCaixaController } from './livro-caixa.controller';
import { LivroCaixaService } from './livro-caixa.service';
import { ApuracaoCarneLeaoController } from './apuracao-carne-leao.controller';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';
import { ParametroFiscalPfService } from './parametro-fiscal-pf.service';

@Module({
  controllers: [
    RendimentoAutonomoController,
    DeducaoCarneLeaoController,
    LivroCaixaController,
    ApuracaoCarneLeaoController,
  ],
  providers: [
    RendimentoAutonomoService,
    DeducaoCarneLeaoService,
    LivroCaixaService,
    ApuracaoCarneLeaoService,
    ParametroFiscalPfService,
  ],
})
export class CarneLeaoModule {}
```

```ts
// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { CategoriaModule } from './categoria/categoria.module';
import { TransacaoModule } from './transacao/transacao.module';
import { CarneLeaoModule } from './carne-leao/carne-leao.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WorkspaceModule,
    CategoriaModule,
    TransacaoModule,
    CarneLeaoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 5: Rodar toda a suíte unitária do backend**

Run: `npm run test -w backend`
Expected: todos os testes passam.

- [ ] **Step 6: Commit**

```bash
git add backend/src/carne-leao/rendimento-autonomo.controller.ts backend/src/carne-leao/rendimento-autonomo.controller.spec.ts backend/src/carne-leao/deducao-carne-leao.controller.ts backend/src/carne-leao/deducao-carne-leao.controller.spec.ts backend/src/carne-leao/livro-caixa.controller.ts backend/src/carne-leao/livro-caixa.controller.spec.ts backend/src/carne-leao/apuracao-carne-leao.controller.ts backend/src/carne-leao/apuracao-carne-leao.controller.spec.ts backend/src/carne-leao/carne-leao.module.ts backend/src/app.module.ts
git commit -m "feat: adiciona controllers do carnê-leão e integra CarneLeaoModule ao AppModule"
```

---

### Task 10: Teste e2e do fluxo de carnê-leão

**Files:**
- Create: `backend/test/carne-leao.e2e-spec.ts`

**Interfaces:**
- Consumes: `AppModule`, `PrismaService`, `randomValidCpf` (`./fixtures/cpf`, já existente).

Este teste cria seu **próprio** `ParametroFiscalPF` de teste para um ano fictício (`2031`) — não depende dos valores oficiais de 2026 (Task 11) e não deve colidir com eles.

- [ ] **Step 1: Escrever o teste e2e**

```ts
// backend/test/carne-leao.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { randomValidCpf } from './fixtures/cpf';

describe('CarneLeao (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];
  const ANO_TESTE = 2031;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    // Valores de teste ilustrativos — não são os valores oficiais de 2026.
    await prisma.parametroFiscalPF.create({
      data: {
        anoCalendario: ANO_TESTE,
        faixaIsencaoMensal: 2000,
        faixaReducaoAte: 3000,
        tetoEducacaoAnual: 3561.5,
        valorDependenteMensal: 189.59,
        descontoSimplificadoMensal: 500,
        limiteObrigatoriedadeDeclaracao: 35584,
        tabelaProgressivaMensal: [
          { ate: 2000, aliquota: 0, parcelaDeduzir: 0 },
          { ate: 3000, aliquota: 0.1, parcelaDeduzir: 100 },
          { ate: 999999999, aliquota: 0.2, parcelaDeduzir: 400 },
        ],
      },
    });
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.rendimentoAutonomo.deleteMany({ where: { usuarioId: { in: createdUserIds } } });
      await prisma.deducaoCarneLeao.deleteMany({ where: { usuarioId: { in: createdUserIds } } });
      await prisma.livroCaixaLancamento.deleteMany({ where: { usuarioId: { in: createdUserIds } } });
      await prisma.apuracaoMensalCarneLeao.deleteMany({ where: { usuarioId: { in: createdUserIds } } });
      await prisma.usuario.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.parametroFiscalPF.delete({ where: { anoCalendario: ANO_TESTE } });
    await app.close();
  });

  async function registrarUsuario(): Promise<string> {
    const unique = `${Date.now()}-${Math.random()}`;
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nome: 'Carne Leao Teste',
        email: `carne-leao-e2e-${unique}@example.com`,
        cpf: randomValidCpf(),
        senha: 'password123',
      })
      .expect(201);

    createdUserIds.push(response.body.usuario.id);
    return response.body.accessToken as string;
  }

  it('lança rendimento, dedução e livro-caixa, e a apuração reflete cada mudança', async () => {
    const accessToken = await registrarUsuario();

    await request(app.getHttpServer())
      .post('/rendimentos-autonomos')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        tipo: 'HONORARIO',
        fontePagadoraCpf: randomValidCpf(),
        valorBruto: 6000,
        competencia: `${ANO_TESTE}-01-10`,
      })
      .expect(201);

    let apuracao = await request(app.getHttpServer())
      .get(`/apuracoes-carne-leao?ano=${ANO_TESTE}&mes=1`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(apuracao.body.baseCalculo).toBe(5500); // 6000 - max(0, 500)

    const deducaoResponse = await request(app.getHttpServer())
      .post('/deducoes-carne-leao')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tipo: 'INSS_AUTONOMO', valor: 1000, competencia: `${ANO_TESTE}-01-10` })
      .expect(201);

    apuracao = await request(app.getHttpServer())
      .get(`/apuracoes-carne-leao?ano=${ANO_TESTE}&mes=1`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(apuracao.body.baseCalculo).toBe(5000); // 6000 - max(1000, 500)

    await request(app.getHttpServer())
      .post('/livro-caixa')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        descricao: 'aluguel do escritório',
        categoria: 'aluguel_escritorio',
        valor: 300,
        competencia: `${ANO_TESTE}-01-10`,
      })
      .expect(201);

    apuracao = await request(app.getHttpServer())
      .get(`/apuracoes-carne-leao?ano=${ANO_TESTE}&mes=1`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(apuracao.body.baseCalculo).toBe(4700); // 6000 - max(1000+300, 500)

    const rendimentosList = await request(app.getHttpServer())
      .get(`/rendimentos-autonomos?ano=${ANO_TESTE}&mes=1`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(rendimentosList.body).toHaveLength(1);

    await request(app.getHttpServer())
      .patch(`/deducoes-carne-leao/${deducaoResponse.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ valor: 1200 })
      .expect(200);

    apuracao = await request(app.getHttpServer())
      .get(`/apuracoes-carne-leao?ano=${ANO_TESTE}&mes=1`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(apuracao.body.baseCalculo).toBe(4500); // 6000 - max(1200+300, 500)

    await request(app.getHttpServer())
      .delete(`/deducoes-carne-leao/${deducaoResponse.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    apuracao = await request(app.getHttpServer())
      .get(`/apuracoes-carne-leao?ano=${ANO_TESTE}&mes=1`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(apuracao.body.baseCalculo).toBe(5500); // 6000 - max(300, 500), dedução excluída
  });

  it('rejeita editar ou excluir um rendimento de outro usuário', async () => {
    const tokenA = await registrarUsuario();
    const tokenB = await registrarUsuario();

    const createResponse = await request(app.getHttpServer())
      .post('/rendimentos-autonomos')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        tipo: 'ALUGUEL_PF',
        fontePagadoraCpf: randomValidCpf(),
        valorBruto: 1000,
        competencia: `${ANO_TESTE}-02-01`,
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/rendimentos-autonomos/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ valorBruto: 2000 })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/rendimentos-autonomos/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('rejeita uma requisição sem autenticação', async () => {
    await request(app.getHttpServer())
      .get(`/rendimentos-autonomos?ano=${ANO_TESTE}&mes=1`)
      .expect(401);
  });
});
```

- [ ] **Step 2: Rodar o teste e2e**

Run: `npm run test:e2e -w backend`
Expected: PASS (3 testes em `CarneLeao (e2e)`, mais os suites já existentes).

- [ ] **Step 3: Commit**

```bash
git add backend/test/carne-leao.e2e-spec.ts
git commit -m "test: adiciona teste e2e do fluxo de carnê-leão"
```

---

### Task 11: Seed dos valores oficiais de 2026 (BLOQUEADA — aguardando valores do usuário)

**Files:**
- Create: `backend/src/carne-leao/parametro-fiscal-pf-2026.constants.ts`
- Modify: `backend/src/carne-leao/carne-leao.module.ts`

**Interfaces:**
- Consumes: `ParametroFiscalPfService.ensureSeed` (Task 4), `ParametroFiscalPfDados`.
- Produces: `PARAMETRO_FISCAL_PF_2026: ParametroFiscalPfDados`, `CarneLeaoModule` implementando `OnModuleInit`.

**⚠️ ESTA TASK NÃO PODE SER EXECUTADA COM VALORES INVENTADOS.** Antes de implementar, confirme com o usuário do sistema (não o próprio agente) os valores oficiais de 2026 para: `faixaIsencaoMensal`, `faixaReducaoAte`, `tetoEducacaoAnual`, `valorDependenteMensal`, `descontoSimplificadoMensal`, `limiteObrigatoriedadeDeclaracao`, `tabelaProgressivaMensal` (array de `{ ate, aliquota, parcelaDeduzir }`). Se esta task for despachada para um implementador sem esses valores preenchidos abaixo, o implementador deve reportar `NEEDS_CONTEXT` e parar — nunca preencher com números de exemplo ou de anos anteriores.

- [ ] **Step 1: Preencher os valores oficiais (controller faz isso antes de despachar, com os valores fornecidos pelo usuário)**

```ts
// backend/src/carne-leao/parametro-fiscal-pf-2026.constants.ts
import { ParametroFiscalPfDados } from './parametro-fiscal-pf.service';

export const PARAMETRO_FISCAL_PF_2026: ParametroFiscalPfDados = {
  faixaIsencaoMensal: /* PREENCHER com valor oficial 2026 */,
  faixaReducaoAte: /* PREENCHER com valor oficial 2026 */,
  tetoEducacaoAnual: /* PREENCHER com valor oficial 2026 */,
  valorDependenteMensal: /* PREENCHER com valor oficial 2026 */,
  descontoSimplificadoMensal: /* PREENCHER com valor oficial 2026 */,
  limiteObrigatoriedadeDeclaracao: /* PREENCHER com valor oficial 2026 */,
  tabelaProgressivaMensal: [
    /* PREENCHER com a tabela progressiva mensal oficial 2026,
       array de { ate: number, aliquota: number, parcelaDeduzir: number } */
  ],
};
```

- [ ] **Step 2: Escrever e rodar um smoke test manual**

Com o backend rodando (`npm run dev:backend`) e o Postgres local ativo, reiniciar o processo e confirmar via `psql` ou Prisma Studio que a tabela `parametros_fiscais_pf` recebeu uma linha com `ano_calendario = 2026` e os valores preenchidos no Step 1 (não valores de teste).

- [ ] **Step 3: Ligar o auto-seed no boot do módulo**

```ts
// backend/src/carne-leao/carne-leao.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { RendimentoAutonomoController } from './rendimento-autonomo.controller';
import { RendimentoAutonomoService } from './rendimento-autonomo.service';
import { DeducaoCarneLeaoController } from './deducao-carne-leao.controller';
import { DeducaoCarneLeaoService } from './deducao-carne-leao.service';
import { LivroCaixaController } from './livro-caixa.controller';
import { LivroCaixaService } from './livro-caixa.service';
import { ApuracaoCarneLeaoController } from './apuracao-carne-leao.controller';
import { ApuracaoCarneLeaoService } from './apuracao-carne-leao.service';
import { ParametroFiscalPfService } from './parametro-fiscal-pf.service';
import { PARAMETRO_FISCAL_PF_2026 } from './parametro-fiscal-pf-2026.constants';

@Module({
  controllers: [
    RendimentoAutonomoController,
    DeducaoCarneLeaoController,
    LivroCaixaController,
    ApuracaoCarneLeaoController,
  ],
  providers: [
    RendimentoAutonomoService,
    DeducaoCarneLeaoService,
    LivroCaixaService,
    ApuracaoCarneLeaoService,
    ParametroFiscalPfService,
  ],
})
export class CarneLeaoModule implements OnModuleInit {
  constructor(private readonly parametroFiscalPfService: ParametroFiscalPfService) {}

  async onModuleInit(): Promise<void> {
    await this.parametroFiscalPfService.ensureSeed(2026, PARAMETRO_FISCAL_PF_2026);
  }
}
```

- [ ] **Step 4: Rodar toda a suíte (unit + e2e) e confirmar que nada quebrou**

Run: `npm run test -w backend && npm run test:e2e -w backend`
Expected: todos os testes passam (o e2e da Task 10 usa seu próprio ano de teste 2031, não é afetado).

- [ ] **Step 5: Commit**

```bash
git add backend/src/carne-leao/parametro-fiscal-pf-2026.constants.ts backend/src/carne-leao/carne-leao.module.ts
git commit -m "feat: adiciona seed dos parâmetros fiscais PF de 2026 no boot do CarneLeaoModule"
```

---

### Task 12: Frontend — `carne-leao-api.ts`

**Files:**
- Create: `frontend/src/lib/carne-leao-api.ts`

**Interfaces:**
- Consumes: `apiGet`/`apiPost`/`apiPatch`/`apiDelete` (`@/lib/api`).
- Produces: tipos `TipoRendimentoAutonomo`, `TipoDeducaoCarneLeao`, `RendimentoAutonomo`, `DeducaoCarneLeao`, `LivroCaixaLancamento`, `ApuracaoCarneLeao`; funções `createRendimento`, `updateRendimento`, `deleteRendimento`, `createDeducao`, `updateDeducao`, `deleteDeducao`, `createLivroCaixa`, `updateLivroCaixa`, `deleteLivroCaixa`.

- [ ] **Step 1: Implementar**

```ts
// frontend/src/lib/carne-leao-api.ts
import { apiDelete, apiPatch, apiPost } from '@/lib/api';

export type TipoRendimentoAutonomo = 'HONORARIO' | 'ALUGUEL_PF' | 'PENSAO_RECEBIDA' | 'EXTERIOR';
export type TipoDeducaoCarneLeao = 'INSS_AUTONOMO' | 'PENSAO_JUDICIAL' | 'PGBL';

export interface RendimentoAutonomo {
  id: string;
  tipo: TipoRendimentoAutonomo;
  fontePagadoraCpf: string | null;
  valorBruto: number;
  documentoFiscalId: string | null;
  competencia: string;
}

export interface RendimentoAutonomoInput {
  tipo: TipoRendimentoAutonomo;
  fontePagadoraCpf?: string;
  valorBruto: number;
  documentoFiscalId?: string;
  competencia: string;
}

export interface DeducaoCarneLeao {
  id: string;
  tipo: TipoDeducaoCarneLeao;
  valor: number;
  anexoUrl: string | null;
  competencia: string;
}

export interface DeducaoCarneLeaoInput {
  tipo: TipoDeducaoCarneLeao;
  valor: number;
  anexoUrl?: string;
  competencia: string;
}

export interface LivroCaixaLancamento {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  competencia: string;
}

export interface LivroCaixaInput {
  descricao: string;
  categoria: string;
  valor: number;
  competencia: string;
}

export interface ApuracaoCarneLeao {
  id: string;
  rendimentoBrutoTotal: number;
  deducoesTotal: number;
  baseCalculo: number;
  aliquotaEfetiva: number;
  impostoDevido: number;
  codigoReceita: string;
  vencimento: string;
  status: 'PENDENTE' | 'PAGO' | 'ATRASADO';
  calculoIncerto: boolean;
}

export function createRendimento(input: RendimentoAutonomoInput): Promise<RendimentoAutonomo> {
  return apiPost<RendimentoAutonomo>('/rendimentos-autonomos', input);
}

export function updateRendimento(
  id: string,
  input: Partial<RendimentoAutonomoInput>,
): Promise<RendimentoAutonomo> {
  return apiPatch<RendimentoAutonomo>(`/rendimentos-autonomos/${id}`, input);
}

export function deleteRendimento(id: string): Promise<void> {
  return apiDelete<void>(`/rendimentos-autonomos/${id}`);
}

export function createDeducao(input: DeducaoCarneLeaoInput): Promise<DeducaoCarneLeao> {
  return apiPost<DeducaoCarneLeao>('/deducoes-carne-leao', input);
}

export function updateDeducao(
  id: string,
  input: Partial<DeducaoCarneLeaoInput>,
): Promise<DeducaoCarneLeao> {
  return apiPatch<DeducaoCarneLeao>(`/deducoes-carne-leao/${id}`, input);
}

export function deleteDeducao(id: string): Promise<void> {
  return apiDelete<void>(`/deducoes-carne-leao/${id}`);
}

export function createLivroCaixa(input: LivroCaixaInput): Promise<LivroCaixaLancamento> {
  return apiPost<LivroCaixaLancamento>('/livro-caixa', input);
}

export function updateLivroCaixa(
  id: string,
  input: Partial<LivroCaixaInput>,
): Promise<LivroCaixaLancamento> {
  return apiPatch<LivroCaixaLancamento>(`/livro-caixa/${id}`, input);
}

export function deleteLivroCaixa(id: string): Promise<void> {
  return apiDelete<void>(`/livro-caixa/${id}`);
}
```

- [ ] **Step 2: Verificar que o frontend compila**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: sem erros de tipo.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/carne-leao-api.ts
git commit -m "feat: adiciona carne-leao-api"
```

---

### Task 13: Frontend — `useCarneLeaoMes`

**Files:**
- Create: `frontend/src/hooks/use-carne-leao-mes.ts`

**Interfaces:**
- Consumes: `apiGet` (`@/lib/api`), tipos de `@/lib/carne-leao-api` (Task 12).
- Produces: `useCarneLeaoMes(ano, mes): { rendimentos, deducoes, livroCaixa, apuracao, isLoading, error, refetch }`.

- [ ] **Step 1: Implementar**

```ts
// frontend/src/hooks/use-carne-leao-mes.ts
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { apiGet } from '@/lib/api';
import type {
  ApuracaoCarneLeao,
  DeducaoCarneLeao,
  LivroCaixaLancamento,
  RendimentoAutonomo,
} from '@/lib/carne-leao-api';

interface UseCarneLeaoMesResult {
  rendimentos: RendimentoAutonomo[];
  deducoes: DeducaoCarneLeao[];
  livroCaixa: LivroCaixaLancamento[];
  apuracao: ApuracaoCarneLeao | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useCarneLeaoMes(ano: number, mes: number): UseCarneLeaoMesResult {
  const [rendimentos, setRendimentos] = useState<RendimentoAutonomo[]>([]);
  const [deducoes, setDeducoes] = useState<DeducaoCarneLeao[]>([]);
  const [livroCaixa, setLivroCaixa] = useState<LivroCaixaLancamento[]>([]);
  const [apuracao, setApuracao] = useState<ApuracaoCarneLeao | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);

  const fetchTudo = useCallback(async (): Promise<void> => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const query = `?ano=${ano}&mes=${mes}`;
      const [rendimentosResult, deducoesResult, livroCaixaResult, apuracaoResult] =
        await Promise.all([
          apiGet<RendimentoAutonomo[]>(`/rendimentos-autonomos${query}`),
          apiGet<DeducaoCarneLeao[]>(`/deducoes-carne-leao${query}`),
          apiGet<LivroCaixaLancamento[]>(`/livro-caixa${query}`),
          apiGet<ApuracaoCarneLeao | null>(`/apuracoes-carne-leao${query}`),
        ]);
      if (requestIdRef.current === requestId) {
        setRendimentos(rendimentosResult);
        setDeducoes(deducoesResult);
        setLivroCaixa(livroCaixaResult);
        setApuracao(apuracaoResult);
      }
    } catch (err) {
      if (requestIdRef.current === requestId) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [ano, mes]);

  useFocusEffect(
    useCallback(() => {
      fetchTudo();
    }, [fetchTudo]),
  );

  return { rendimentos, deducoes, livroCaixa, apuracao, isLoading, error, refetch: fetchTudo };
}
```

- [ ] **Step 2: Verificar que o frontend compila**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: sem erros de tipo.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/use-carne-leao-mes.ts
git commit -m "feat: adiciona useCarneLeaoMes"
```

---

### Task 14: Frontend — tela `lancar-rendimento.tsx`

**Files:**
- Create: `frontend/src/app/(app)/lancar-rendimento.tsx`

**Interfaces:**
- Consumes: `createRendimento`/`updateRendimento` (`@/lib/carne-leao-api`, Task 12).
- Produces: rota `/lancar-rendimento`, navegável para criar (sem params) ou editar (com `id` + campos atuais via params).

- [ ] **Step 1: Implementar**

```tsx
// frontend/src/app/(app)/lancar-rendimento.tsx
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  createRendimento,
  updateRendimento,
  type TipoRendimentoAutonomo,
} from '@/lib/carne-leao-api';
import { Spacing } from '@/constants/theme';

const TIPOS: { valor: TipoRendimentoAutonomo; label: string }[] = [
  { valor: 'HONORARIO', label: 'Honorário' },
  { valor: 'ALUGUEL_PF', label: 'Aluguel' },
  { valor: 'PENSAO_RECEBIDA', label: 'Pensão' },
  { valor: 'EXTERIOR', label: 'Exterior' },
];

function competenciaAtualAAAAMM(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function LancarRendimentoScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    tipo?: string;
    fontePagadoraCpf?: string;
    valorBruto?: string;
    competencia?: string;
  }>();
  const isEditing = typeof params.id === 'string';

  const [tipo, setTipo] = useState<TipoRendimentoAutonomo>(
    (params.tipo as TipoRendimentoAutonomo) ?? 'HONORARIO',
  );
  const [fontePagadoraCpf, setFontePagadoraCpf] = useState(params.fontePagadoraCpf ?? '');
  const [valorBruto, setValorBruto] = useState(params.valorBruto ?? '');
  const [competencia, setCompetencia] = useState(
    params.competencia ? params.competencia.slice(0, 7) : competenciaAtualAAAAMM(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    const valorNumerico = Number(valorBruto.replace(',', '.'));
    if (!valorBruto || Number.isNaN(valorNumerico) || valorNumerico <= 0) {
      setError('informe um valor bruto válido');
      return;
    }
    if (tipo !== 'EXTERIOR' && !fontePagadoraCpf) {
      setError('informe o CPF da fonte pagadora');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(competencia)) {
      setError('competência deve estar no formato AAAA-MM');
      return;
    }

    setIsSubmitting(true);
    try {
      const input = {
        tipo,
        fontePagadoraCpf: tipo === 'EXTERIOR' ? undefined : fontePagadoraCpf,
        valorBruto: valorNumerico,
        competencia: `${competencia}-01`,
      };
      if (isEditing && typeof params.id === 'string') {
        await updateRendimento(params.id, input);
      } else {
        await createRendimento(input);
      }
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao salvar rendimento');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">
          {isEditing ? 'Editar rendimento' : 'Novo rendimento'}
        </ThemedText>

        <ThemedView style={styles.tipoRow}>
          {TIPOS.map((item) => (
            <Pressable
              key={item.valor}
              onPress={() => setTipo(item.valor)}
              style={[styles.tipoOption, tipo === item.valor && styles.tipoOptionActive]}>
              <ThemedText type="small">{item.label}</ThemedText>
            </Pressable>
          ))}
        </ThemedView>

        {tipo !== 'EXTERIOR' && (
          <TextInput
            placeholder="CPF da fonte pagadora"
            value={fontePagadoraCpf}
            onChangeText={setFontePagadoraCpf}
            style={styles.input}
          />
        )}

        <TextInput
          placeholder="valor bruto"
          keyboardType="decimal-pad"
          value={valorBruto}
          onChangeText={setValorBruto}
          style={styles.input}
        />

        <TextInput
          placeholder="competência (AAAA-MM)"
          value={competencia}
          onChangeText={setCompetencia}
          style={styles.input}
        />

        {error && <ThemedText themeColor="textSecondary">{error}</ThemedText>}

        <Pressable onPress={handleSubmit} disabled={isSubmitting} style={styles.button}>
          <ThemedText type="smallBold">{isSubmitting ? 'salvando...' : 'salvar'}</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four, gap: Spacing.three },
  input: {
    borderWidth: 1,
    borderColor: '#8888',
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  tipoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tipoOption: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderColor: '#8888',
    borderRadius: Spacing.two,
  },
  tipoOptionActive: { backgroundColor: '#3c87f7' },
  button: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
  },
});
```

- [ ] **Step 2: Verificar que o frontend compila**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: sem erros de tipo. Se houver erro de rota desconhecida, rodar `npx expo start --web` brevemente (só até compilar o bundle) e cancelar — isso regenera `frontend/.expo/types/router.d.ts`, depois rodar o `tsc` de novo.

- [ ] **Step 3: Commit**

```bash
git add "frontend/src/app/(app)/lancar-rendimento.tsx"
git commit -m "feat: adiciona tela de lançamento/edição de rendimento autônomo"
```

---

### Task 15: Frontend — tela `lancar-deducao.tsx`

**Files:**
- Create: `frontend/src/app/(app)/lancar-deducao.tsx`

**Interfaces:**
- Consumes: `createDeducao`/`updateDeducao` (`@/lib/carne-leao-api`, Task 12).
- Produces: rota `/lancar-deducao`, criar/editar.

- [ ] **Step 1: Implementar**

```tsx
// frontend/src/app/(app)/lancar-deducao.tsx
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { createDeducao, updateDeducao, type TipoDeducaoCarneLeao } from '@/lib/carne-leao-api';
import { Spacing } from '@/constants/theme';

const TIPOS: { valor: TipoDeducaoCarneLeao; label: string }[] = [
  { valor: 'INSS_AUTONOMO', label: 'INSS autônomo' },
  { valor: 'PENSAO_JUDICIAL', label: 'Pensão judicial' },
  { valor: 'PGBL', label: 'PGBL' },
];

function competenciaAtualAAAAMM(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function LancarDeducaoScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    tipo?: string;
    valor?: string;
    anexoUrl?: string;
    competencia?: string;
  }>();
  const isEditing = typeof params.id === 'string';

  const [tipo, setTipo] = useState<TipoDeducaoCarneLeao>(
    (params.tipo as TipoDeducaoCarneLeao) ?? 'INSS_AUTONOMO',
  );
  const [valor, setValor] = useState(params.valor ?? '');
  const [anexoUrl, setAnexoUrl] = useState(params.anexoUrl ?? '');
  const [competencia, setCompetencia] = useState(
    params.competencia ? params.competencia.slice(0, 7) : competenciaAtualAAAAMM(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    const valorNumerico = Number(valor.replace(',', '.'));
    if (!valor || Number.isNaN(valorNumerico) || valorNumerico <= 0) {
      setError('informe um valor válido');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(competencia)) {
      setError('competência deve estar no formato AAAA-MM');
      return;
    }

    setIsSubmitting(true);
    try {
      const input = {
        tipo,
        valor: valorNumerico,
        anexoUrl: anexoUrl || undefined,
        competencia: `${competencia}-01`,
      };
      if (isEditing && typeof params.id === 'string') {
        await updateDeducao(params.id, input);
      } else {
        await createDeducao(input);
      }
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao salvar dedução');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">{isEditing ? 'Editar dedução' : 'Nova dedução'}</ThemedText>

        <ThemedView style={styles.tipoRow}>
          {TIPOS.map((item) => (
            <Pressable
              key={item.valor}
              onPress={() => setTipo(item.valor)}
              style={[styles.tipoOption, tipo === item.valor && styles.tipoOptionActive]}>
              <ThemedText type="small">{item.label}</ThemedText>
            </Pressable>
          ))}
        </ThemedView>

        <TextInput
          placeholder="valor"
          keyboardType="decimal-pad"
          value={valor}
          onChangeText={setValor}
          style={styles.input}
        />

        <TextInput
          placeholder="competência (AAAA-MM)"
          value={competencia}
          onChangeText={setCompetencia}
          style={styles.input}
        />

        <TextInput
          placeholder="comprovante (URL, opcional)"
          value={anexoUrl}
          onChangeText={setAnexoUrl}
          style={styles.input}
        />

        {error && <ThemedText themeColor="textSecondary">{error}</ThemedText>}

        <Pressable onPress={handleSubmit} disabled={isSubmitting} style={styles.button}>
          <ThemedText type="smallBold">{isSubmitting ? 'salvando...' : 'salvar'}</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four, gap: Spacing.three },
  input: {
    borderWidth: 1,
    borderColor: '#8888',
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  tipoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tipoOption: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderColor: '#8888',
    borderRadius: Spacing.two,
  },
  tipoOptionActive: { backgroundColor: '#3c87f7' },
  button: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
  },
});
```

- [ ] **Step 2: Verificar que o frontend compila**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: sem erros de tipo.

- [ ] **Step 3: Commit**

```bash
git add "frontend/src/app/(app)/lancar-deducao.tsx"
git commit -m "feat: adiciona tela de lançamento/edição de dedução do carnê-leão"
```

---

### Task 16: Frontend — tela `lancar-livro-caixa.tsx`

**Files:**
- Create: `frontend/src/app/(app)/lancar-livro-caixa.tsx`

**Interfaces:**
- Consumes: `createLivroCaixa`/`updateLivroCaixa` (`@/lib/carne-leao-api`, Task 12).
- Produces: rota `/lancar-livro-caixa`, criar/editar.

- [ ] **Step 1: Implementar**

```tsx
// frontend/src/app/(app)/lancar-livro-caixa.tsx
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { createLivroCaixa, updateLivroCaixa } from '@/lib/carne-leao-api';
import { Spacing } from '@/constants/theme';

function competenciaAtualAAAAMM(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function LancarLivroCaixaScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    descricao?: string;
    categoria?: string;
    valor?: string;
    competencia?: string;
  }>();
  const isEditing = typeof params.id === 'string';

  const [descricao, setDescricao] = useState(params.descricao ?? '');
  const [categoria, setCategoria] = useState(params.categoria ?? '');
  const [valor, setValor] = useState(params.valor ?? '');
  const [competencia, setCompetencia] = useState(
    params.competencia ? params.competencia.slice(0, 7) : competenciaAtualAAAAMM(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    const valorNumerico = Number(valor.replace(',', '.'));
    if (!descricao) {
      setError('informe a descrição');
      return;
    }
    if (!categoria) {
      setError('informe a categoria');
      return;
    }
    if (!valor || Number.isNaN(valorNumerico) || valorNumerico <= 0) {
      setError('informe um valor válido');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(competencia)) {
      setError('competência deve estar no formato AAAA-MM');
      return;
    }

    setIsSubmitting(true);
    try {
      const input = { descricao, categoria, valor: valorNumerico, competencia: `${competencia}-01` };
      if (isEditing && typeof params.id === 'string') {
        await updateLivroCaixa(params.id, input);
      } else {
        await createLivroCaixa(input);
      }
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao salvar lançamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">
          {isEditing ? 'Editar lançamento' : 'Novo lançamento de livro-caixa'}
        </ThemedText>

        <TextInput
          placeholder="descrição"
          value={descricao}
          onChangeText={setDescricao}
          style={styles.input}
        />

        <TextInput
          placeholder="categoria (ex: aluguel_escritorio, material)"
          value={categoria}
          onChangeText={setCategoria}
          style={styles.input}
        />

        <TextInput
          placeholder="valor"
          keyboardType="decimal-pad"
          value={valor}
          onChangeText={setValor}
          style={styles.input}
        />

        <TextInput
          placeholder="competência (AAAA-MM)"
          value={competencia}
          onChangeText={setCompetencia}
          style={styles.input}
        />

        {error && <ThemedText themeColor="textSecondary">{error}</ThemedText>}

        <Pressable onPress={handleSubmit} disabled={isSubmitting} style={styles.button}>
          <ThemedText type="smallBold">{isSubmitting ? 'salvando...' : 'salvar'}</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four, gap: Spacing.three },
  input: {
    borderWidth: 1,
    borderColor: '#8888',
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  button: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
  },
});
```

- [ ] **Step 2: Verificar que o frontend compila**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: sem erros de tipo.

- [ ] **Step 3: Commit**

```bash
git add "frontend/src/app/(app)/lancar-livro-caixa.tsx"
git commit -m "feat: adiciona tela de lançamento/edição de item de livro-caixa"
```

---

### Task 17: Frontend — navegação (aba Carnê-leão) + tela principal

**Files:**
- Modify: `frontend/src/components/app-tabs.tsx`
- Modify: `frontend/src/components/app-tabs.web.tsx`
- Modify: `frontend/src/app/(app)/_layout.tsx`
- Move: `frontend/src/app/(app)/(tabs)/explore.tsx` → `frontend/src/app/(app)/(tabs)/carne-leao.tsx` (conteúdo totalmente substituído)

**Interfaces:**
- Consumes: `useCarneLeaoMes` (Task 13), `deleteRendimento`/`deleteDeducao`/`deleteLivroCaixa` (Task 12), rotas `/lancar-rendimento` (Task 14), `/lancar-deducao` (Task 15), `/lancar-livro-caixa` (Task 16).
- Produces: aba "Carnê-leão" no lugar de "Explore".

- [ ] **Step 1: Mover a tela e substituir o conteúdo**

```bash
git mv "frontend/src/app/(app)/(tabs)/explore.tsx" "frontend/src/app/(app)/(tabs)/carne-leao.tsx"
```

```tsx
// frontend/src/app/(app)/(tabs)/carne-leao.tsx
import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCarneLeaoMes } from '@/hooks/use-carne-leao-mes';
import {
  deleteDeducao,
  deleteLivroCaixa,
  deleteRendimento,
  type DeducaoCarneLeao,
  type LivroCaixaLancamento,
  type RendimentoAutonomo,
} from '@/lib/carne-leao-api';
import { BottomTabInset, Spacing } from '@/constants/theme';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatMoeda(valor: number): string {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`;
}

export default function CarneLeaoScreen() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const { rendimentos, deducoes, livroCaixa, apuracao, isLoading, error, refetch } =
    useCarneLeaoMes(ano, mes);

  const irParaMesAnterior = () => {
    if (mes === 1) {
      setAno(ano - 1);
      setMes(12);
    } else {
      setMes(mes - 1);
    }
  };

  const irParaProximoMes = () => {
    if (mes === 12) {
      setAno(ano + 1);
      setMes(1);
    } else {
      setMes(mes + 1);
    }
  };

  const confirmarExclusao = (tipo: 'rendimento' | 'deducao' | 'livro-caixa', id: string) => {
    Alert.alert('Excluir lançamento', 'Tem certeza que deseja excluir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            if (tipo === 'rendimento') await deleteRendimento(id);
            if (tipo === 'deducao') await deleteDeducao(id);
            if (tipo === 'livro-caixa') await deleteLivroCaixa(id);
            await refetch();
          } catch {
            Alert.alert('Erro', 'não foi possível excluir o lançamento.');
          }
        },
      },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <Pressable onPress={irParaMesAnterior}>
            <ThemedText type="smallBold">◀</ThemedText>
          </Pressable>
          <ThemedText type="subtitle">
            {MESES[mes - 1]} {ano}
          </ThemedText>
          <Pressable onPress={irParaProximoMes}>
            <ThemedText type="smallBold">▶</ThemedText>
          </Pressable>
        </ThemedView>

        {isLoading && <ThemedText type="small">carregando...</ThemedText>}
        {error && (
          <ThemedText themeColor="expense">
            erro ao carregar carnê-leão: {error.message}
          </ThemedText>
        )}

        <ScrollView contentContainerStyle={styles.list}>
          <ThemedView style={styles.card}>
            {apuracao ? (
              <>
                <ThemedText type="smallBold">
                  Rendimento bruto: {formatMoeda(apuracao.rendimentoBrutoTotal)}
                </ThemedText>
                <ThemedText type="small">Deduções: {formatMoeda(apuracao.deducoesTotal)}</ThemedText>
                <ThemedText type="small">
                  Base de cálculo: {formatMoeda(apuracao.baseCalculo)}
                </ThemedText>
                <ThemedText type="smallBold" themeColor="expense">
                  Imposto devido: {formatMoeda(apuracao.impostoDevido)}
                </ThemedText>
                <ThemedText type="small">Vencimento: {apuracao.vencimento.slice(0, 10)}</ThemedText>
                {apuracao.calculoIncerto && (
                  <ThemedText type="small" themeColor="expense">
                    cálculo incerto — confira no Carnê-Leão Web, valor pode estar superestimado
                  </ThemedText>
                )}
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                nenhum lançamento este mês
              </ThemedText>
            )}
          </ThemedView>

          <ThemedView style={styles.secao}>
            <ThemedView style={styles.secaoHeader}>
              <ThemedText type="smallBold">Rendimentos</ThemedText>
              <Pressable onPress={() => router.push('/lancar-rendimento')}>
                <ThemedText type="smallBold">+</ThemedText>
              </Pressable>
            </ThemedView>
            {rendimentos.map((item: RendimentoAutonomo) => (
              <Pressable
                key={item.id}
                style={styles.item}
                onPress={() =>
                  router.push({
                    pathname: '/lancar-rendimento',
                    params: {
                      id: item.id,
                      tipo: item.tipo,
                      fontePagadoraCpf: item.fontePagadoraCpf ?? undefined,
                      valorBruto: String(item.valorBruto),
                      competencia: item.competencia.slice(0, 10),
                    },
                  })
                }
                onLongPress={() => confirmarExclusao('rendimento', item.id)}>
                <ThemedText type="small">{item.tipo}</ThemedText>
                <ThemedText type="small">{formatMoeda(item.valorBruto)}</ThemedText>
              </Pressable>
            ))}
          </ThemedView>

          <ThemedView style={styles.secao}>
            <ThemedView style={styles.secaoHeader}>
              <ThemedText type="smallBold">Deduções</ThemedText>
              <Pressable onPress={() => router.push('/lancar-deducao')}>
                <ThemedText type="smallBold">+</ThemedText>
              </Pressable>
            </ThemedView>
            {deducoes.map((item: DeducaoCarneLeao) => (
              <Pressable
                key={item.id}
                style={styles.item}
                onPress={() =>
                  router.push({
                    pathname: '/lancar-deducao',
                    params: {
                      id: item.id,
                      tipo: item.tipo,
                      valor: String(item.valor),
                      anexoUrl: item.anexoUrl ?? undefined,
                      competencia: item.competencia.slice(0, 10),
                    },
                  })
                }
                onLongPress={() => confirmarExclusao('deducao', item.id)}>
                <ThemedText type="small">{item.tipo}</ThemedText>
                <ThemedText type="small">{formatMoeda(item.valor)}</ThemedText>
              </Pressable>
            ))}
          </ThemedView>

          <ThemedView style={styles.secao}>
            <ThemedView style={styles.secaoHeader}>
              <ThemedText type="smallBold">Livro-caixa</ThemedText>
              <Pressable onPress={() => router.push('/lancar-livro-caixa')}>
                <ThemedText type="smallBold">+</ThemedText>
              </Pressable>
            </ThemedView>
            {livroCaixa.map((item: LivroCaixaLancamento) => (
              <Pressable
                key={item.id}
                style={styles.item}
                onPress={() =>
                  router.push({
                    pathname: '/lancar-livro-caixa',
                    params: {
                      id: item.id,
                      descricao: item.descricao,
                      categoria: item.categoria,
                      valor: String(item.valor),
                      competencia: item.competencia.slice(0, 10),
                    },
                  })
                }
                onLongPress={() => confirmarExclusao('livro-caixa', item.id)}>
                <ThemedText type="small">{item.descricao}</ThemedText>
                <ThemedText type="small">{formatMoeda(item.valor)}</ThemedText>
              </Pressable>
            ))}
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset,
    gap: Spacing.three,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  list: { gap: Spacing.three },
  card: {
    borderWidth: 1,
    borderColor: '#8888',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  secao: { gap: Spacing.two },
  secaoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#8888',
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
});
```

- [ ] **Step 2: Trocar a aba "Explore" por "Carnê-leão" (nativo)**

```tsx
// frontend/src/components/app-tabs.tsx
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="carne-leao">
        <NativeTabs.Trigger.Label>Carnê-leão</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="text.book.closed" md="menu_book" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

- [ ] **Step 3: Trocar a aba "Explore" por "Carnê-leão" (web)**

Em `frontend/src/components/app-tabs.web.tsx`, troque:

```tsx
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton>Explore</TabButton>
          </TabTrigger>
```

por:

```tsx
          <TabTrigger name="carne-leao" href="/carne-leao" asChild>
            <TabButton>Carnê-leão</TabButton>
          </TabTrigger>
```

(resto do arquivo continua igual.)

- [ ] **Step 4: Adicionar as 3 rotas modais no `Stack`**

```tsx
// frontend/src/app/(app)/_layout.tsx
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function AppLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="nova-transacao"
          options={{ presentation: 'modal', headerShown: true, title: 'Transação' }}
        />
        <Stack.Screen
          name="lancar-rendimento"
          options={{ presentation: 'modal', headerShown: true, title: 'Rendimento' }}
        />
        <Stack.Screen
          name="lancar-deducao"
          options={{ presentation: 'modal', headerShown: true, title: 'Dedução' }}
        />
        <Stack.Screen
          name="lancar-livro-caixa"
          options={{ presentation: 'modal', headerShown: true, title: 'Livro-caixa' }}
        />
      </Stack>
    </ThemeProvider>
  );
}
```

- [ ] **Step 5: Verificar que o frontend compila**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: sem erros de tipo. Se houver erro de rota desconhecida (`/carne-leao` ou similar), rodar `npx expo start --web` brevemente pra regenerar `frontend/.expo/types/router.d.ts`, cancelar, e rodar o `tsc` de novo.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/app-tabs.tsx frontend/src/components/app-tabs.web.tsx "frontend/src/app/(app)/_layout.tsx" "frontend/src/app/(app)/(tabs)"
git commit -m "feat: adiciona aba Carnê-leão e tela principal com lista mensal"
```

---

### Task 18: Verificação manual de ponta a ponta

**Files:** nenhum (só validação)

- [ ] **Step 1: Subir o backend e o app**

```bash
npm run db:up
npm run dev:backend
```

Em outro terminal: `npx expo start --web` dentro de `frontend/`.

Se a Task 11 (seed dos valores oficiais de 2026) ainda não foi executada, insira manualmente uma linha de teste em `parametros_fiscais_pf` para o ano corrente antes de continuar (via `psql` ou Prisma Studio) — sem isso a apuração vai retornar `404` (parâmetro fiscal do ano não cadastrado) em vez de calcular.

- [ ] **Step 2: Testar o fluxo completo de um rendimento**

Na aba "Carnê-leão", confirme que aparece o mês atual sem lançamentos. Toque no "+" de Rendimentos, preencha um honorário (ex: R$ 2.000, CPF de teste válido) e salve. Confirme que volta pra tela e o card de apuração mostra valores calculados.

- [ ] **Step 3: Testar dedução e livro-caixa**

Lance uma dedução INSS e um item de livro-caixa no mesmo mês. Confirme que o card de apuração (base de cálculo, imposto devido) muda a cada lançamento.

- [ ] **Step 4: Testar edição e exclusão**

Toque num lançamento, altere o valor, salve, confirme que a apuração recalcula. Exclua um lançamento (long-press + confirmar — na web, `Alert.alert` não funciona no `react-native-web`, então valide a exclusão via chamada direta à API/curl, como feito no módulo de transações).

- [ ] **Step 5: Testar navegação entre meses**

Lance um rendimento com competência do mês anterior. Volte pra tela principal, use "◀" pra ir ao mês anterior e confirme que ele aparece lá (e não no mês atual).

- [ ] **Step 6: Testar isolamento entre usuários (via curl)**

Registre uma segunda conta, pegue o `accessToken` dela e tente editar/excluir um rendimento da primeira conta:

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X PATCH http://localhost:3000/rendimentos-autonomos/<ID_DO_RENDIMENTO_DA_CONTA_A> \
  -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN_DA_CONTA_B>" \
  -d '{"valorBruto":9999}'
```

Confirme `HTTP 404`.

Nenhum commit nesta task — é validação manual do que já foi commitado nas tasks anteriores. Se algum passo falhar, volte pra task correspondente, corrija e re-commit.
