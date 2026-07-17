import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { apiGet } from '@/lib/api';
import {
  createTransacao,
  updateTransacao,
  type Categoria,
  type TransacaoTipo,
} from '@/lib/transacoes-api';
import { Spacing } from '@/constants/theme';

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NovaTransacaoScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    tipo?: string;
    valor?: string;
    categoriaId?: string;
    descricao?: string;
    data?: string;
  }>();
  const isEditing = typeof params.id === 'string';

  const [tipo, setTipo] = useState<TransacaoTipo>(
    params.tipo === 'RECEITA' ? 'RECEITA' : 'DESPESA',
  );
  const [valor, setValor] = useState(params.valor ?? '');
  const [categoriaId, setCategoriaId] = useState<string | undefined>(
    params.categoriaId,
  );
  const [descricao, setDescricao] = useState(params.descricao ?? '');
  const [data, setData] = useState(params.data ?? todayISODate());
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    apiGet<Categoria[]>('/categorias')
      .then((result) => {
        if (active) {
          setCategorias(result);
        }
      })
      .catch(() => {
        // lista de categorias é auxiliar (seleção opcional); uma falha
        // aqui não deve travar o formulário de lançamento.
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async () => {
    setError(null);
    const valorNumerico = Number(valor.replace(',', '.'));
    if (!valor || Number.isNaN(valorNumerico) || valorNumerico <= 0) {
      setError('informe um valor válido');
      return;
    }

    setIsSubmitting(true);
    try {
      const input = {
        tipo,
        valor: valorNumerico,
        categoriaId,
        descricao: descricao || undefined,
        data,
      };
      if (isEditing && typeof params.id === 'string') {
        await updateTransacao(params.id, input);
      } else {
        await createTransacao(input);
      }
      router.back();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'erro ao salvar transação',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">
          {isEditing ? 'Editar transação' : 'Nova transação'}
        </ThemedText>

        <ThemedView style={styles.toggleRow}>
          <Pressable
            onPress={() => setTipo('RECEITA')}
            style={[
              styles.toggleOption,
              tipo === 'RECEITA' && styles.toggleOptionActive,
            ]}>
            <ThemedText type="smallBold">Receita</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setTipo('DESPESA')}
            style={[
              styles.toggleOption,
              tipo === 'DESPESA' && styles.toggleOptionActive,
            ]}>
            <ThemedText type="smallBold">Despesa</ThemedText>
          </Pressable>
        </ThemedView>

        <TextInput
          placeholder="valor"
          keyboardType="decimal-pad"
          value={valor}
          onChangeText={setValor}
          style={styles.input}
        />

        <TextInput
          placeholder="data (AAAA-MM-DD)"
          value={data}
          onChangeText={setData}
          style={styles.input}
        />

        <TextInput
          placeholder="descrição (opcional)"
          value={descricao}
          onChangeText={setDescricao}
          style={styles.input}
        />

        <ThemedView style={styles.categoriaRow}>
          {categorias.map((categoria) => (
            <Pressable
              key={categoria.id}
              onPress={() =>
                setCategoriaId(
                  categoriaId === categoria.id ? undefined : categoria.id,
                )
              }
              style={[
                styles.categoriaChip,
                categoriaId === categoria.id && styles.categoriaChipActive,
              ]}>
              <ThemedText type="small">{categoria.nome}</ThemedText>
            </Pressable>
          ))}
        </ThemedView>

        {error && <ThemedText themeColor="textSecondary">{error}</ThemedText>}

        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={styles.button}>
          <ThemedText type="smallBold">
            {isSubmitting ? 'salvando...' : 'salvar'}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  input: {
    borderWidth: 1,
    borderColor: '#8888',
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  toggleOption: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#8888',
    borderRadius: Spacing.two,
  },
  toggleOptionActive: {
    backgroundColor: '#3c87f7',
  },
  categoriaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  categoriaChip: {
    borderWidth: 1,
    borderColor: '#8888',
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  categoriaChipActive: {
    backgroundColor: '#3c87f7',
  },
  button: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
  },
});
