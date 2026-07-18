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
