import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { createFaturamento, updateFaturamento, type EmissorTipo } from '@/lib/pj-api';
import { Spacing } from '@/constants/theme';

function competenciaAtualAAAAMM(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function LancarFaturamentoScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    empresaId: string;
    receitaBrutaTotal?: string;
    receitaComNota?: string;
    receitaSemNota?: string;
    clienteTipoPredominante?: string;
    competencia?: string;
  }>();
  const isEditing = typeof params.id === 'string';

  const [receitaBrutaTotal, setReceitaBrutaTotal] = useState(params.receitaBrutaTotal ?? '');
  const [receitaComNota, setReceitaComNota] = useState(params.receitaComNota ?? '');
  const [receitaSemNota, setReceitaSemNota] = useState(params.receitaSemNota ?? '');
  const [clienteTipoPredominante] = useState<EmissorTipo | undefined>(
    params.clienteTipoPredominante as EmissorTipo | undefined,
  );
  const [competencia, setCompetencia] = useState(
    params.competencia ? params.competencia.slice(0, 7) : competenciaAtualAAAAMM(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    const receitaNumerica = Number(receitaBrutaTotal.replace(',', '.'));
    if (!receitaBrutaTotal || Number.isNaN(receitaNumerica) || receitaNumerica < 0) {
      setError('informe um valor de receita bruta válido');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(competencia)) {
      setError('competência deve estar no formato AAAA-MM');
      return;
    }

    setIsSubmitting(true);
    try {
      const receitaComNotaNumerica = receitaComNota ? Number(receitaComNota.replace(',', '.')) : undefined;
      const receitaSemNotaNumerica = receitaSemNota ? Number(receitaSemNota.replace(',', '.')) : undefined;

      if (isEditing && typeof params.id === 'string') {
        await updateFaturamento(params.id, {
          receitaBrutaTotal: receitaNumerica,
          receitaComNota: receitaComNotaNumerica,
          receitaSemNota: receitaSemNotaNumerica,
          clienteTipoPredominante,
        });
      } else {
        await createFaturamento({
          empresaId: params.empresaId,
          receitaBrutaTotal: receitaNumerica,
          receitaComNota: receitaComNotaNumerica,
          receitaSemNota: receitaSemNotaNumerica,
          clienteTipoPredominante,
          competencia: `${competencia}-01`,
        });
      }
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao salvar faturamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">
          {isEditing ? 'Editar faturamento' : 'Novo faturamento mensal'}
        </ThemedText>

        <TextInput
          placeholder="receita bruta total"
          keyboardType="decimal-pad"
          value={receitaBrutaTotal}
          onChangeText={setReceitaBrutaTotal}
          style={styles.input}
        />

        <TextInput
          placeholder="receita com nota (opcional)"
          keyboardType="decimal-pad"
          value={receitaComNota}
          onChangeText={setReceitaComNota}
          style={styles.input}
        />

        <TextInput
          placeholder="receita sem nota (opcional)"
          keyboardType="decimal-pad"
          value={receitaSemNota}
          onChangeText={setReceitaSemNota}
          style={styles.input}
        />

        <TextInput
          placeholder="competência (AAAA-MM)"
          value={competencia}
          onChangeText={setCompetencia}
          editable={!isEditing}
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
