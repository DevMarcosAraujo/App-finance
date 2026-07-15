import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useWorkspace } from '@/contexts/workspace-context';
import type { PlanoTipo } from '@/contexts/workspace-context';
import { Spacing } from '@/constants/theme';

export default function OnboardingScreen() {
  const { createWorkspace } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChoose = async (tipo: PlanoTipo) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await createWorkspace(tipo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao criar workspace');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">Como você vai usar o app?</ThemedText>

        <Pressable
          onPress={() => handleChoose('INDIVIDUAL')}
          disabled={isSubmitting}
          style={styles.card}>
          <ThemedText type="smallBold">Individual</ThemedText>
          <ThemedText type="small">
            Uso solo, com opção de convidar alguém depois.
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => handleChoose('FAMILIA')}
          disabled={isSubmitting}
          style={styles.card}>
          <ThemedText type="smallBold">Família / Casal</ThemedText>
          <ThemedText type="small">
            Carteira compartilhada, com identificação de quem registrou cada
            movimentação.
          </ThemedText>
        </Pressable>

        {error && <ThemedText themeColor="textSecondary">{error}</ThemedText>}
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
  card: {
    borderWidth: 1,
    borderColor: '#8888',
    borderRadius: Spacing.two,
    padding: Spacing.four,
    gap: Spacing.one,
  },
});
