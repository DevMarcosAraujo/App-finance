# Login e Registro — Card Centralizado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar as telas de login e registro (`frontend/src/app/(auth)/`) para renderizar um card centralizado usando a cor `accent` do design system, em vez do formulário atual ocupando a tela toda com cores genéricas.

**Architecture:** Mudança puramente de apresentação (React Native + `StyleSheet`) em dois arquivos de tela já existentes — sem novo estado, sem mudança de lógica de submit/validação, sem novos componentes compartilhados além de uma constante de layout. Adiciona `AuthCardMaxWidth` a `frontend/src/constants/theme.ts`, ao lado de `MaxContentWidth`.

**Tech Stack:** React Native + Expo Router (frontend apenas). Sem dependências novas.

## Global Constraints

- Esta branch parte de `worktree-relatorios-e-identidade-visual` (não de `main`), pois depende das cores `accent`/`accentSoft` já adicionadas lá em `frontend/src/constants/theme.ts` (light: `accent: '#7C3AED'`; dark: `accent: '#A78BFA'`) — não recriar essas cores.
- Sem mudança de campos, validação ou lógica de submissão — só layout/cor.
- `theme.accent` deve ser consumido via `useTheme()` (dinâmico light/dark), nunca hardcoded como hex.
- Sem novas dependências de estilo (sem Tailwind/NativeWind) — continua `StyleSheet` + `ThemedText`/`ThemedView`.
- Escopo: só `login.tsx` e `register.tsx`. Nenhuma landing page ou menu de navegação novo.

---

## File Structure

**Modificado:**
- `frontend/src/constants/theme.ts` — adiciona `AuthCardMaxWidth = 420`.
- `frontend/src/app/(auth)/login.tsx` — novo layout com card centralizado.
- `frontend/src/app/(auth)/register.tsx` — mesmo tratamento.

Nenhum arquivo novo é criado.

---

### Task 1: `AuthCardMaxWidth` no design system

**Files:**
- Modify: `frontend/src/constants/theme.ts`

**Interfaces:**
- Produces: `export const AuthCardMaxWidth = 420;` — consumida pelas Tasks 2 e 3.

- [ ] **Step 1: Adicionar a constante**

Modificar `frontend/src/constants/theme.ts`, adicionando após a linha de `MaxContentWidth`:

```ts
export const MaxContentWidth = 800;
export const AuthCardMaxWidth = 420;
```

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/constants/theme.ts
git commit -m "feat: adiciona largura máxima do card de autenticação ao design system"
```

---

### Task 2: Redesenho da tela de login

**Files:**
- Modify: `frontend/src/app/(auth)/login.tsx`

**Interfaces:**
- Consumes: `AuthCardMaxWidth` (Task 1), `useTheme()` (`@/hooks/use-theme`, já existente), `Colors.accent`/`Colors.background` via `theme.accent`.
- Produces: nenhuma interface nova — mesmo componente `LoginScreen`, mesmo comportamento de `handleSubmit`/`login`.

- [ ] **Step 1: Reescrever o JSX e os estilos**

Substituir o conteúdo de `frontend/src/app/(auth)/login.tsx` por:

```tsx
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { AuthCardMaxWidth, Spacing } from '@/constants/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, senha);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao entrar');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle">Entrar</ThemedText>

          <ThemedView type="backgroundElement" style={styles.inputWrapper}>
            <TextInput
              placeholder="email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
            />
          </ThemedView>
          <ThemedView type="backgroundElement" style={styles.inputWrapper}>
            <TextInput
              placeholder="senha"
              secureTextEntry
              value={senha}
              onChangeText={setSenha}
              style={styles.input}
            />
          </ThemedView>

          {error && <ThemedText themeColor="expense">{error}</ThemedText>}

          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={[styles.button, { backgroundColor: theme.accent }]}>
            <ThemedText type="smallBold" themeColor="background">
              {isSubmitting ? 'entrando...' : 'entrar'}
            </ThemedText>
          </Pressable>

          <Link href="/(auth)/register" style={styles.link}>
            <ThemedText type="linkPrimary">criar uma conta</ThemedText>
          </Link>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: AuthCardMaxWidth,
    borderRadius: Spacing.three,
    padding: Spacing.five,
    gap: Spacing.three,
  },
  inputWrapper: {
    borderRadius: Spacing.two,
  },
  input: {
    padding: Spacing.three,
  },
  button: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  link: {
    alignSelf: 'center',
  },
});
```

Nota de design: o `inputWrapper` usa `type="backgroundElement"`, o mesmo tom de fundo do `card` — isso funciona porque o `TextInput` interno não tem fundo próprio (transparente), então o input aparece como uma faixa dentro do card. Se visualmente os dois fundos ficarem indistinguíveis (mesmo tom sobre o mesmo tom), trocar `inputWrapper` para `type="backgroundSelected"` (um tom levemente mais contrastante já existente no tema) — decidir isso na verificação visual do Step 3, não adivinhar agora.

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Verificação visual manual**

Run: `cd frontend && npx expo start --web` (ou a porta que estiver livre)

Abrir a tela de login no navegador e confirmar:
- O card aparece centralizado (vertical e horizontal), com largura máxima visível em telas largas.
- O input não se confunde visualmente com o fundo do card (ver nota do Step 1 — trocar para `backgroundSelected` se necessário).
- O botão "entrar" usa a cor accent (violeta) e o texto é legível (branco/claro) sobre ela.
- Alternar entre tema claro/escuro do sistema operacional (ou emulador) e confirmar que o card e o botão se adaptam corretamente.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/\(auth\)/login.tsx
git commit -m "feat: redesenha tela de login com card centralizado e cor accent"
```

---

### Task 3: Redesenho da tela de registro

**Files:**
- Modify: `frontend/src/app/(auth)/register.tsx`

**Interfaces:**
- Consumes: mesmas de Task 2 (`AuthCardMaxWidth`, `useTheme()`).
- Produces: nenhuma — mesmo componente `RegisterScreen`, mesmo comportamento de `handleSubmit`/`register`.

- [ ] **Step 1: Reescrever o JSX e os estilos**

Substituir o conteúdo de `frontend/src/app/(auth)/register.tsx` por:

```tsx
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { AuthCardMaxWidth, Spacing } from '@/constants/theme';

export default function RegisterScreen() {
  const { register } = useAuth();
  const theme = useTheme();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (senha !== confirmarSenha) {
      setError('as senhas não são iguais');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(nome, email, cpf, senha);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao criar conta');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle">Criar conta</ThemedText>

          <ThemedView type="backgroundElement" style={styles.inputWrapper}>
            <TextInput
              placeholder="nome"
              value={nome}
              onChangeText={setNome}
              style={styles.input}
            />
          </ThemedView>
          <ThemedView type="backgroundElement" style={styles.inputWrapper}>
            <TextInput
              placeholder="email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
            />
          </ThemedView>
          <ThemedView type="backgroundElement" style={styles.inputWrapper}>
            <TextInput
              placeholder="cpf"
              keyboardType="numeric"
              value={cpf}
              onChangeText={setCpf}
              style={styles.input}
            />
          </ThemedView>
          <ThemedView type="backgroundElement" style={styles.inputWrapper}>
            <TextInput
              placeholder="senha"
              secureTextEntry
              value={senha}
              onChangeText={setSenha}
              style={styles.input}
            />
          </ThemedView>
          <ThemedView type="backgroundElement" style={styles.inputWrapper}>
            <TextInput
              placeholder="confirmar senha"
              secureTextEntry
              value={confirmarSenha}
              onChangeText={setConfirmarSenha}
              style={styles.input}
            />
          </ThemedView>

          {error && <ThemedText themeColor="expense">{error}</ThemedText>}

          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={[styles.button, { backgroundColor: theme.accent }]}>
            <ThemedText type="smallBold" themeColor="background">
              {isSubmitting ? 'criando...' : 'criar conta'}
            </ThemedText>
          </Pressable>

          <Link href="/(auth)/login" style={styles.link}>
            <ThemedText type="linkPrimary">já tenho conta</ThemedText>
          </Link>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: AuthCardMaxWidth,
    borderRadius: Spacing.three,
    padding: Spacing.five,
    gap: Spacing.three,
  },
  inputWrapper: {
    borderRadius: Spacing.two,
  },
  input: {
    padding: Spacing.three,
  },
  button: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  link: {
    alignSelf: 'center',
  },
});
```

Usar na tela de registro a mesma decisão tomada na Task 2 para `inputWrapper` (`backgroundElement` vs `backgroundSelected`), para manter as duas telas visualmente consistentes.

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Verificação visual manual**

Run: `cd frontend && npx expo start --web`

Abrir a tela de registro e confirmar os mesmos pontos da Task 2 (card centralizado, input legível, botão accent, tema claro/escuro), além de: os 5 inputs empilhados não estourarem a altura da tela em telas pequenas (rolagem nativa do teclado deve continuar funcionando, já que não foi adicionado nenhum `ScrollView` novo — confirmar que isso não virou um problema com 5 campos dentro do card).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/\(auth\)/register.tsx
git commit -m "feat: redesenha tela de registro com card centralizado e cor accent"
```

---

## Fora de escopo (repetido da spec)

- Landing page ou menu de navegação antes do login.
- Mudança de campos ou lógica de validação/submissão.
- Extensão da cor `accent` para outras telas além de login/registro.
