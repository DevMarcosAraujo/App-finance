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
