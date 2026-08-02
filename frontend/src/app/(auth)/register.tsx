import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import { AuthSplitLayout } from '@/components/auth-split-layout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

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
}

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
