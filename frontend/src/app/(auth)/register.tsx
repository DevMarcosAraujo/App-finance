import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import { Spacing } from '@/constants/theme';

export default function RegisterScreen() {
  const { register } = useAuth();
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
        <ThemedText type="title">Criar conta</ThemedText>

        <TextInput
          placeholder="nome"
          value={nome}
          onChangeText={setNome}
          style={styles.input}
        />
        <TextInput
          placeholder="email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TextInput
          placeholder="cpf"
          keyboardType="numeric"
          value={cpf}
          onChangeText={setCpf}
          style={styles.input}
        />
        <TextInput
          placeholder="senha"
          secureTextEntry
          value={senha}
          onChangeText={setSenha}
          style={styles.input}
        />
        <TextInput
          placeholder="confirmar senha"
          secureTextEntry
          value={confirmarSenha}
          onChangeText={setConfirmarSenha}
          style={styles.input}
        />

        {error && <ThemedText themeColor="textSecondary">{error}</ThemedText>}

        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={styles.button}>
          <ThemedText type="smallBold">
            {isSubmitting ? 'criando...' : 'criar conta'}
          </ThemedText>
        </Pressable>

        <Link href="/(auth)/login">
          <ThemedText type="linkPrimary">já tenho conta</ThemedText>
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
