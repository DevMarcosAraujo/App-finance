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

          <ThemedView type="backgroundSelected" style={styles.inputWrapper}>
            <TextInput
              placeholder="nome"
              value={nome}
              onChangeText={setNome}
              style={styles.input}
            />
          </ThemedView>
          <ThemedView type="backgroundSelected" style={styles.inputWrapper}>
            <TextInput
              placeholder="email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
            />
          </ThemedView>
          <ThemedView type="backgroundSelected" style={styles.inputWrapper}>
            <TextInput
              placeholder="cpf"
              keyboardType="numeric"
              value={cpf}
              onChangeText={setCpf}
              style={styles.input}
            />
          </ThemedView>
          <ThemedView type="backgroundSelected" style={styles.inputWrapper}>
            <TextInput
              placeholder="senha"
              secureTextEntry
              value={senha}
              onChangeText={setSenha}
              style={styles.input}
            />
          </ThemedView>
          <ThemedView type="backgroundSelected" style={styles.inputWrapper}>
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
