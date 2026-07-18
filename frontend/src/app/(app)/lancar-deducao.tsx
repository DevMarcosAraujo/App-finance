import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { createDeducao, updateDeducao, type TipoDeducaoCarneLeao } from '@/lib/carne-leao-api';
import { Spacing } from '@/constants/theme';

const TIPOS: { valor: TipoDeducaoCarneLeao; label: string }[] = [
  { valor: 'INSS_AUTONOMO', label: 'INSS autônomo' },
  { valor: 'PENSAO_JUDICIAL', label: 'Pensão judicial' },
  { valor: 'PGBL', label: 'PGBL' },
];

function competenciaAtualAAAAMM(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function LancarDeducaoScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    tipo?: string;
    valor?: string;
    anexoUrl?: string;
    competencia?: string;
  }>();
  const isEditing = typeof params.id === 'string';

  const [tipo, setTipo] = useState<TipoDeducaoCarneLeao>(
    (params.tipo as TipoDeducaoCarneLeao) ?? 'INSS_AUTONOMO',
  );
  const [valor, setValor] = useState(params.valor ?? '');
  const [anexoUrl, setAnexoUrl] = useState(params.anexoUrl ?? '');
  const [competencia, setCompetencia] = useState(
    params.competencia ? params.competencia.slice(0, 7) : competenciaAtualAAAAMM(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    const valorNumerico = Number(valor.replace(',', '.'));
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
      const input = {
        tipo,
        valor: valorNumerico,
        anexoUrl: anexoUrl || undefined,
        competencia: `${competencia}-01`,
      };
      if (isEditing && typeof params.id === 'string') {
        await updateDeducao(params.id, input);
      } else {
        await createDeducao(input);
      }
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao salvar dedução');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">{isEditing ? 'Editar dedução' : 'Nova dedução'}</ThemedText>

        <ThemedView style={styles.tipoRow}>
          {TIPOS.map((item) => (
            <Pressable
              key={item.valor}
              onPress={() => setTipo(item.valor)}
              style={[styles.tipoOption, tipo === item.valor && styles.tipoOptionActive]}>
              <ThemedText type="small">{item.label}</ThemedText>
            </Pressable>
          ))}
        </ThemedView>

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

        <TextInput
          placeholder="comprovante (URL, opcional)"
          value={anexoUrl}
          onChangeText={setAnexoUrl}
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
  tipoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tipoOption: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderColor: '#8888',
    borderRadius: Spacing.two,
  },
  tipoOptionActive: { backgroundColor: '#3c87f7' },
  button: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
  },
});
