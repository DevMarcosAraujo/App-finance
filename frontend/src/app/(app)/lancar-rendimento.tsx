import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  createRendimento,
  updateRendimento,
  type TipoRendimentoAutonomo,
} from '@/lib/carne-leao-api';
import { Spacing } from '@/constants/theme';

const TIPOS: { valor: TipoRendimentoAutonomo; label: string }[] = [
  { valor: 'HONORARIO', label: 'Honorário' },
  { valor: 'ALUGUEL_PF', label: 'Aluguel' },
  { valor: 'PENSAO_RECEBIDA', label: 'Pensão' },
  { valor: 'EXTERIOR', label: 'Exterior' },
];

function competenciaAtualAAAAMM(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function LancarRendimentoScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    tipo?: string;
    fontePagadoraCpf?: string;
    valorBruto?: string;
    competencia?: string;
  }>();
  const isEditing = typeof params.id === 'string';

  const [tipo, setTipo] = useState<TipoRendimentoAutonomo>(
    (params.tipo as TipoRendimentoAutonomo) ?? 'HONORARIO',
  );
  const [fontePagadoraCpf, setFontePagadoraCpf] = useState(params.fontePagadoraCpf ?? '');
  const [valorBruto, setValorBruto] = useState(params.valorBruto ?? '');
  const [competencia, setCompetencia] = useState(
    params.competencia ? params.competencia.slice(0, 7) : competenciaAtualAAAAMM(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    const valorNumerico = Number(valorBruto.replace(',', '.'));
    if (!valorBruto || Number.isNaN(valorNumerico) || valorNumerico <= 0) {
      setError('informe um valor bruto válido');
      return;
    }
    if (tipo !== 'EXTERIOR' && !fontePagadoraCpf) {
      setError('informe o CPF da fonte pagadora');
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
        fontePagadoraCpf: tipo === 'EXTERIOR' ? undefined : fontePagadoraCpf,
        valorBruto: valorNumerico,
        competencia: `${competencia}-01`,
      };
      if (isEditing && typeof params.id === 'string') {
        await updateRendimento(params.id, input);
      } else {
        await createRendimento(input);
      }
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao salvar rendimento');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">
          {isEditing ? 'Editar rendimento' : 'Novo rendimento'}
        </ThemedText>

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

        {tipo !== 'EXTERIOR' && (
          <TextInput
            placeholder="CPF da fonte pagadora"
            value={fontePagadoraCpf}
            onChangeText={setFontePagadoraCpf}
            style={styles.input}
          />
        )}

        <TextInput
          placeholder="valor bruto"
          keyboardType="decimal-pad"
          value={valorBruto}
          onChangeText={setValorBruto}
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
