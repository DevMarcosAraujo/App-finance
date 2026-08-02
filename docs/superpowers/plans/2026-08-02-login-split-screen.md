# Login e Registro — Split-Screen Responsivo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um layout split-screen responsivo (gradiente + texto de destaque de um lado, formulário do outro) às telas de login e registro em telas largas (≥900px), mantendo o card centralizado já implementado sem nenhuma mudança em telas estreitas (mobile nativo e web estreito).

**Architecture:** Novo componente compartilhado `AuthSplitLayout` que decide o layout via `useWindowDimensions()` e envolve o conteúdo específico de cada tela (título, inputs, botão, link — que `login.tsx`/`register.tsx` continuam definindo). Nenhuma mudança de estado, validação ou lógica de submit.

**Tech Stack:** React Native + Expo Router (frontend apenas). Nova dependência: `expo-linear-gradient`.

## Global Constraints

- Esta branch continua em cima de `login-card-centralizado` (que já depende de `worktree-relatorios-e-identidade-visual` para as cores `accent`/`accentSoft`) — não recriar essas cores nem o card mobile já implementado.
- Comportamento mobile (< 900px) deve ficar **pixel-idêntico** ao que já existe hoje (card centralizado, sem gradiente, sem texto de destaque) — zero mudança visual nessa faixa de largura.
- Em telas ≥ 900px, o formulário ocupa a metade direita **sem** `maxWidth`/centralização própria (usa a largura inteira do painel, só com padding) — diferente do comportamento mobile, que usa `AuthCardMaxWidth`.
- Sem link "esqueci a senha", sem foto real (só gradiente de cor), mesmo texto de destaque em login e registro.
- Sem mudança de campos, validação ou lógica de `handleSubmit`/`login`/`register`.

---

## File Structure

**Novo:**
- `frontend/src/components/auth-split-layout.tsx` — componente de layout responsivo compartilhado.

**Modificado:**
- `frontend/src/constants/theme.ts` — adiciona `AuthSplitBreakpoint = 900`.
- `frontend/package.json` — nova dependência `expo-linear-gradient`.
- `frontend/src/app/(auth)/login.tsx` — usa `AuthSplitLayout` em vez de montar a estrutura externa sozinho.
- `frontend/src/app/(auth)/register.tsx` — idem.

---

### Task 1: Dependência + breakpoint no design system

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/constants/theme.ts`

**Interfaces:**
- Produces: `expo-linear-gradient` instalado; `export const AuthSplitBreakpoint = 900;` em `theme.ts` — consumido pela Task 2.

- [ ] **Step 1: Instalar `expo-linear-gradient`**

Run: `cd frontend && npx expo install expo-linear-gradient`

- [ ] **Step 2: Adicionar a constante de breakpoint**

Modificar `frontend/src/constants/theme.ts`, adicionando após `AuthCardMaxWidth`:

```ts
export const AuthCardMaxWidth = 420;
export const AuthSplitBreakpoint = 900;
```

- [ ] **Step 3: Verificar tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/constants/theme.ts
git commit -m "chore: adiciona expo-linear-gradient e breakpoint do split-screen de auth"
```

---

### Task 2: Componente `AuthSplitLayout`

**Files:**
- Create: `frontend/src/components/auth-split-layout.tsx`

**Interfaces:**
- Consumes: `AuthCardMaxWidth`, `AuthSplitBreakpoint`, `Spacing` (`@/constants/theme`), `useTheme()` (`@/hooks/use-theme`), `ThemedText`, `ThemedView` (existentes), `LinearGradient` (`expo-linear-gradient`, Task 1).
- Produces: `export function AuthSplitLayout({ children }: PropsWithChildren): JSX.Element` — consumido pelas Tasks 3 e 4.

- [ ] **Step 1: Criar o componente**

```tsx
// frontend/src/components/auth-split-layout.tsx
import type { PropsWithChildren } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { AuthCardMaxWidth, AuthSplitBreakpoint, Spacing } from '@/constants/theme';

const HERO_TEXT = 'Organize as finanças da família em um só lugar';

export function AuthSplitLayout({ children }: PropsWithChildren) {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const isSplit = width >= AuthSplitBreakpoint;

  if (!isSplit) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeAreaMobile}>
          <ThemedView type="backgroundElement" style={styles.cardMobile}>
            {children}
          </ThemedView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.splitRow}>
        <LinearGradient
          colors={[theme.accent, theme.accentSoft]}
          style={styles.gradientPanel}>
          <ThemedText type="title" style={styles.heroText}>
            {HERO_TEXT}
          </ThemedText>
        </LinearGradient>
        <SafeAreaView style={styles.formPanel}>
          <ThemedView type="backgroundElement" style={styles.cardSplit}>
            {children}
          </ThemedView>
        </SafeAreaView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeAreaMobile: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  cardMobile: {
    width: '100%',
    maxWidth: AuthCardMaxWidth,
    borderRadius: Spacing.three,
    padding: Spacing.five,
    gap: Spacing.three,
  },
  splitRow: {
    flex: 1,
    flexDirection: 'row',
  },
  gradientPanel: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.six,
  },
  heroText: {
    color: '#ffffff',
    textAlign: 'center',
  },
  formPanel: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.five,
  },
  cardSplit: {
    width: '100%',
    borderRadius: Spacing.three,
    padding: Spacing.five,
    gap: Spacing.three,
  },
});
```

Nota: `cardSplit` propositalmente **não** tem `maxWidth` (diferente de `cardMobile`, que usa `AuthCardMaxWidth`) — no modo split, o formulário ocupa a largura inteira do painel direito, só limitada pelo `paddingHorizontal` do `formPanel`. Isso é intencional, conforme a spec.

`ThemedText type="title"` já define tamanho/peso de fonte grande (48px) — apropriado para o texto de destaque do painel gradiente, mas sua cor padrão viria do tema (preto/branco conforme claro/escuro). Por isso `heroText` sobrescreve com `color: '#ffffff'` fixo (branco), já que o texto sempre fica sobre um gradiente colorido, não sobre o fundo padrão do tema — não faz sentido esse texto específico mudar de cor com o tema claro/escuro.

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/auth-split-layout.tsx
git commit -m "feat: adiciona componente de layout split-screen responsivo para auth"
```

---

### Task 3: Login usa `AuthSplitLayout`

**Files:**
- Modify: `frontend/src/app/(auth)/login.tsx`

**Interfaces:**
- Consumes: `AuthSplitLayout` (Task 2).
- Produces: nenhuma — mesmo componente `LoginScreen`, mesmo comportamento de `handleSubmit`/`login`.

- [ ] **Step 1: Substituir a estrutura externa pelo `AuthSplitLayout`**

Modificar `frontend/src/app/(auth)/login.tsx`:

- Remover o import de `SafeAreaView` (não é mais usado diretamente aqui) e adicionar `import { AuthSplitLayout } from '@/components/auth-split-layout';`.
- Remover `AuthCardMaxWidth` do import de `@/constants/theme` (só resta `Spacing`), já que o card mobile agora vive dentro de `AuthSplitLayout`.
- Substituir o retorno do componente por:

```tsx
return (
  <AuthSplitLayout>
    <ThemedText type="subtitle">Entrar</ThemedText>

    <ThemedView type="backgroundSelected" style={styles.inputWrapper}>
      <TextInput
        placeholder="email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={[styles.input, { color: theme.text }]}
        placeholderTextColor={theme.textSecondary}
      />
    </ThemedView>
    <ThemedView type="backgroundSelected" style={styles.inputWrapper}>
      <TextInput
        placeholder="senha"
        secureTextEntry
        value={senha}
        onChangeText={setSenha}
        style={[styles.input, { color: theme.text }]}
        placeholderTextColor={theme.textSecondary}
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
  </AuthSplitLayout>
);
```

- Substituir o bloco `const styles = StyleSheet.create({...})` inteiro por (removendo `container`, `safeArea` e `card`, que agora vivem em `AuthSplitLayout`):

```tsx
const styles = StyleSheet.create({
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

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros. Se `ThemedView` ficar sem uso no arquivo (removido junto com `card`/`container`), o import de `ThemedView` **continua necessário** pois ainda é usado nos `inputWrapper`s — não remover esse import.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/\(auth\)/login.tsx
git commit -m "feat: aplica layout split-screen responsivo na tela de login"
```

---

### Task 4: Registro usa `AuthSplitLayout`

**Files:**
- Modify: `frontend/src/app/(auth)/register.tsx`

**Interfaces:**
- Consumes: `AuthSplitLayout` (Task 2).
- Produces: nenhuma — mesmo componente `RegisterScreen`, mesmo comportamento de `handleSubmit`/`register`.

- [ ] **Step 1: Substituir a estrutura externa pelo `AuthSplitLayout`**

Mesmo tratamento da Task 3, aplicado a `frontend/src/app/(auth)/register.tsx`:

- Remover import de `SafeAreaView`, adicionar `import { AuthSplitLayout } from '@/components/auth-split-layout';`.
- Remover `AuthCardMaxWidth` do import de `@/constants/theme`.
- Substituir o retorno por:

```tsx
return (
  <AuthSplitLayout>
    <ThemedText type="subtitle">Criar conta</ThemedText>

    <ThemedView type="backgroundSelected" style={styles.inputWrapper}>
      <TextInput
        placeholder="nome"
        value={nome}
        onChangeText={setNome}
        style={[styles.input, { color: theme.text }]}
        placeholderTextColor={theme.textSecondary}
      />
    </ThemedView>
    <ThemedView type="backgroundSelected" style={styles.inputWrapper}>
      <TextInput
        placeholder="email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={[styles.input, { color: theme.text }]}
        placeholderTextColor={theme.textSecondary}
      />
    </ThemedView>
    <ThemedView type="backgroundSelected" style={styles.inputWrapper}>
      <TextInput
        placeholder="cpf"
        keyboardType="numeric"
        value={cpf}
        onChangeText={setCpf}
        style={[styles.input, { color: theme.text }]}
        placeholderTextColor={theme.textSecondary}
      />
    </ThemedView>
    <ThemedView type="backgroundSelected" style={styles.inputWrapper}>
      <TextInput
        placeholder="senha"
        secureTextEntry
        value={senha}
        onChangeText={setSenha}
        style={[styles.input, { color: theme.text }]}
        placeholderTextColor={theme.textSecondary}
      />
    </ThemedView>
    <ThemedView type="backgroundSelected" style={styles.inputWrapper}>
      <TextInput
        placeholder="confirmar senha"
        secureTextEntry
        value={confirmarSenha}
        onChangeText={setConfirmarSenha}
        style={[styles.input, { color: theme.text }]}
        placeholderTextColor={theme.textSecondary}
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
  </AuthSplitLayout>
);
```

- Substituir o bloco de estilos pelo mesmo reduzido da Task 3 (`inputWrapper`, `input`, `button`, `link` — sem `container`/`safeArea`/`card`).

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/\(auth\)/register.tsx
git commit -m "feat: aplica layout split-screen responsivo na tela de registro"
```

---

### Task 5: Verificação visual manual

**Files:**
- Nenhum arquivo novo — apenas verificação.

**Interfaces:** N/A.

- [ ] **Step 1: Rodar o app na web**

Run: `cd frontend && npx expo start --web` (escolher uma porta livre se a padrão estiver ocupada)

- [ ] **Step 2: Verificar telas largas (≥900px)**

Redimensionar a janela do navegador para ≥900px de largura e confirmar:
- Login e registro mostram o split-screen: gradiente `accent`→`accentSoft` à esquerda com o texto "Organize as finanças da família em um só lugar" em branco, formulário à direita ocupando a largura do painel (sem ficar com uma faixa vazia grande, já que não tem `maxWidth`).
- Alternar tema claro/escuro do sistema e confirmar que o painel do formulário (fundo, inputs, botão) se adapta, e o gradiente/texto continuam legíveis nos dois casos (o texto é branco fixo, então funciona em ambos).

- [ ] **Step 3: Verificar telas estreitas (<900px)**

Redimensionar para <900px (ou usar as ferramentas de emulação mobile do navegador) e confirmar:
- Login e registro voltam ao card centralizado já existente, sem gradiente, sem texto de destaque — visualmente idêntico ao que já estava implementado antes deste plano.

- [ ] **Step 4: Reportar resultado**

Documentar no relatório da tarefa (se executado via subagente) ou apontar para o humano (se executado sem ferramenta de navegador disponível) que a verificação visual foi ou não realizada, sem afirmar sucesso sem tê-la feito de fato.

---

## Fora de escopo (repetido da spec)

- Link "esqueci a senha".
- Foto/imagem real (usa gradiente de cor).
- Textos de destaque diferentes por tela.
- Mudança de campos, validação ou lógica de submissão.
