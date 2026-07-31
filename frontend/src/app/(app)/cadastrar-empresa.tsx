import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  createEmpresa,
  updateEmpresa,
  type AnexoSimples,
  type AtividadeEmpresa,
  type RegimeEmpresa,
} from '@/lib/pj-api';
import { Spacing } from '@/constants/theme';

const REGIMES: { valor: RegimeEmpresa; label: string }[] = [
  { valor: 'MEI', label: 'MEI' },
  { valor: 'SIMPLES_ME', label: 'Simples (ME)' },
];

const ATIVIDADES: { valor: AtividadeEmpresa; label: string }[] = [
  { valor: 'COMERCIO', label: 'Comércio' },
  { valor: 'INDUSTRIA', label: 'Indústria' },
  { valor: 'SERVICO', label: 'Serviço' },
  { valor: 'COMERCIO_SERVICO', label: 'Comércio + Serviço' },
];

const ANEXOS: AnexoSimples[] = ['I', 'II', 'III', 'IV', 'V'];

export default function CadastrarEmpresaScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    cnpj?: string;
    nome?: string;
    regime?: string;
    atividadeTipo?: string;
    anexoSimples?: string;
    dataAbertura?: string;
  }>();
  const isEditing = typeof params.id === 'string';

  const [cnpj, setCnpj] = useState(params.cnpj ?? '');
  const [nome, setNome] = useState(params.nome ?? '');
  const [regime, setRegime] = useState<RegimeEmpresa>((params.regime as RegimeEmpresa) ?? 'MEI');
  const [atividadeTipo, setAtividadeTipo] = useState<AtividadeEmpresa>(
    (params.atividadeTipo as AtividadeEmpresa) ?? 'SERVICO',
  );
  const [anexoSimples, setAnexoSimples] = useState<AnexoSimples | undefined>(
    params.anexoSimples as AnexoSimples | undefined,
  );
  const [dataAbertura, setDataAbertura] = useState(params.dataAbertura ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!cnpj) {
      setError('informe o CNPJ');
      return;
    }
    if (!nome) {
      setError('informe o nome da empresa');
      return;
    }
    if (regime === 'SIMPLES_ME' && !anexoSimples) {
      setError('informe o Anexo do Simples Nacional');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAbertura)) {
      setError('data de abertura deve estar no formato AAAA-MM-DD');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && typeof params.id === 'string') {
        await updateEmpresa(params.id, {
          nome,
          atividadeTipo,
          anexoSimples: regime === 'SIMPLES_ME' ? anexoSimples : undefined,
        });
      } else {
        await createEmpresa({
          cnpj,
          nome,
          regime,
          atividadeTipo,
          anexoSimples: regime === 'SIMPLES_ME' ? anexoSimples : undefined,
          dataAbertura,
        });
      }
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao salvar empresa');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">{isEditing ? 'Editar empresa' : 'Cadastrar empresa'}</ThemedText>

        <TextInput
          placeholder="CNPJ"
          value={cnpj}
          onChangeText={setCnpj}
          editable={!isEditing}
          style={styles.input}
        />

        <TextInput placeholder="nome" value={nome} onChangeText={setNome} style={styles.input} />

        <ThemedView style={styles.optionRow}>
          {REGIMES.map((item) => (
            <Pressable
              key={item.valor}
              disabled={isEditing}
              onPress={() => setRegime(item.valor)}
              style={[styles.option, regime === item.valor && styles.optionActive]}>
              <ThemedText type="small">{item.label}</ThemedText>
            </Pressable>
          ))}
        </ThemedView>

        <ThemedView style={styles.optionRow}>
          {ATIVIDADES.map((item) => (
            <Pressable
              key={item.valor}
              onPress={() => setAtividadeTipo(item.valor)}
              style={[styles.option, atividadeTipo === item.valor && styles.optionActive]}>
              <ThemedText type="small">{item.label}</ThemedText>
            </Pressable>
          ))}
        </ThemedView>

        {regime === 'SIMPLES_ME' && (
          <ThemedView style={styles.optionRow}>
            {ANEXOS.map((item) => (
              <Pressable
                key={item}
                onPress={() => setAnexoSimples(item)}
                style={[styles.option, anexoSimples === item && styles.optionActive]}>
                <ThemedText type="small">Anexo {item}</ThemedText>
              </Pressable>
            ))}
          </ThemedView>
        )}

        <TextInput
          placeholder="data de abertura (AAAA-MM-DD)"
          value={dataAbertura}
          onChangeText={setDataAbertura}
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
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  option: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderColor: '#8888',
    borderRadius: Spacing.two,
  },
  optionActive: { backgroundColor: '#3c87f7' },
  button: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
  },
});
