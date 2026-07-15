import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import { Spacing } from '@/constants/theme';

export default function LoginScreen() {
  const { login } = useAuth();
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
        <ThemedText type="title">Entrar</ThemedText>

        <TextInput
          placeholder="email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TextInput
          placeholder="senha"
          secureTextEntry
          value={senha}
          onChangeText={setSenha}
          style={styles.input}
        />

        {error && <ThemedText themeColor="textSecondary">{error}</ThemedText>}

        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={styles.button}>
          <ThemedText type="smallBold">
            {isSubmitting ? 'entrando...' : 'entrar'}
          </ThemedText>
        </Pressable>

        <Link href="/(auth)/register">
          <ThemedText type="linkPrimary">criar uma conta</ThemedText>
        </Link>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
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
