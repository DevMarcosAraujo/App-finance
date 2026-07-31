import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { createProLabore, updateProLabore } from '@/lib/pj-api';
import { Spacing } from '@/constants/theme';

function competenciaAtualAAAAMM(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function LancarProLaboreScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    empresaId: string;
    valor?: string;
    inssRetido?: string;
    competencia?: string;
  }>();
  const isEditing = typeof params.id === 'string';

  const [valor, setValor] = useState(params.valor ?? '');
  const [inssRetido, setInssRetido] = useState(params.inssRetido ?? '');
  const [competencia, setCompetencia] = useState(
    params.competencia ? params.competencia.slice(0, 7) : competenciaAtualAAAAMM(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    const valorNumerico = Number(valor.replace(',', '.'));
    const inssNumerico = Number(inssRetido.replace(',', '.'));
    if (!valor || Number.isNaN(valorNumerico) || valorNumerico <= 0) {
      setError('informe um valor de pró-labore válido');
      return;
    }
    if (!inssRetido || Number.isNaN(inssNumerico) || inssNumerico < 0) {
      setError('informe o INSS retido');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(competencia)) {
      setError('competência deve estar no formato AAAA-MM');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && typeof params.id === 'string') {
        await updateProLabore(params.id, {
          valor: valorNumerico,
          inssRetido: inssNumerico,
          competencia: `${competencia}-01`,
        });
      } else {
        await createProLabore({
          empresaId: params.empresaId,
          valor: valorNumerico,
          inssRetido: inssNumerico,
          competencia: `${competencia}-01`,
        });
      }
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao salvar pró-labore');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">{isEditing ? 'Editar pró-labore' : 'Novo pró-labore'}</ThemedText>

        <TextInput
          placeholder="valor do pró-labore"
          keyboardType="decimal-pad"
          value={valor}
          onChangeText={setValor}
          style={styles.input}
        />

        <TextInput
          placeholder="INSS retido"
          keyboardType="decimal-pad"
          value={inssRetido}
          onChangeText={setInssRetido}
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
