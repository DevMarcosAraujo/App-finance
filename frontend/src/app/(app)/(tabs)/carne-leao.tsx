import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCarneLeaoMes } from '@/hooks/use-carne-leao-mes';
import {
  deleteDeducao,
  deleteLivroCaixa,
  deleteRendimento,
  type DeducaoCarneLeao,
  type LivroCaixaLancamento,
  type RendimentoAutonomo,
} from '@/lib/carne-leao-api';
import { BottomTabInset, Spacing } from '@/constants/theme';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatMoeda(valor: number): string {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`;
}

export default function CarneLeaoScreen() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const { rendimentos, deducoes, livroCaixa, apuracao, isLoading, error, refetch } =
    useCarneLeaoMes(ano, mes);

  const irParaMesAnterior = () => {
    if (mes === 1) {
      setAno(ano - 1);
      setMes(12);
    } else {
      setMes(mes - 1);
    }
  };

  const irParaProximoMes = () => {
    if (mes === 12) {
      setAno(ano + 1);
      setMes(1);
    } else {
      setMes(mes + 1);
    }
  };

  const confirmarExclusao = (tipo: 'rendimento' | 'deducao' | 'livro-caixa', id: string) => {
    Alert.alert('Excluir lançamento', 'Tem certeza que deseja excluir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            if (tipo === 'rendimento') await deleteRendimento(id);
            if (tipo === 'deducao') await deleteDeducao(id);
            if (tipo === 'livro-caixa') await deleteLivroCaixa(id);
            await refetch();
          } catch {
            Alert.alert('Erro', 'não foi possível excluir o lançamento.');
          }
        },
      },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <Pressable onPress={irParaMesAnterior}>
            <ThemedText type="smallBold">◀</ThemedText>
          </Pressable>
          <ThemedText type="subtitle">
            {MESES[mes - 1]} {ano}
          </ThemedText>
          <Pressable onPress={irParaProximoMes}>
            <ThemedText type="smallBold">▶</ThemedText>
          </Pressable>
        </ThemedView>

        {isLoading && <ThemedText type="small">carregando...</ThemedText>}
        {error && (
          <ThemedText themeColor="expense">
            erro ao carregar carnê-leão: {error.message}
          </ThemedText>
        )}

        <ScrollView contentContainerStyle={styles.list}>
          <ThemedView style={styles.card}>
            {apuracao ? (
              <>
                <ThemedText type="smallBold">
                  Rendimento bruto: {formatMoeda(apuracao.rendimentoBrutoTotal)}
                </ThemedText>
                <ThemedText type="small">Deduções: {formatMoeda(apuracao.deducoesTotal)}</ThemedText>
                <ThemedText type="small">
                  Base de cálculo: {formatMoeda(apuracao.baseCalculo)}
                </ThemedText>
                <ThemedText type="smallBold" themeColor="expense">
                  Imposto devido: {formatMoeda(apuracao.impostoDevido)}
                </ThemedText>
                <ThemedText type="small">Vencimento: {apuracao.vencimento.slice(0, 10)}</ThemedText>
                {apuracao.calculoIncerto && (
                  <ThemedText type="small" themeColor="expense">
                    cálculo incerto — confira no Carnê-Leão Web, valor pode estar superestimado
                  </ThemedText>
                )}
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                nenhum lançamento este mês
              </ThemedText>
            )}
          </ThemedView>

          <ThemedView style={styles.secao}>
            <ThemedView style={styles.secaoHeader}>
              <ThemedText type="smallBold">Rendimentos</ThemedText>
              <Pressable onPress={() => router.push('/lancar-rendimento')}>
                <ThemedText type="smallBold">+</ThemedText>
              </Pressable>
            </ThemedView>
            {rendimentos.map((item: RendimentoAutonomo) => (
              <Pressable
                key={item.id}
                style={styles.item}
                onPress={() =>
                  router.push({
                    pathname: '/lancar-rendimento',
                    params: {
                      id: item.id,
                      tipo: item.tipo,
                      fontePagadoraCpf: item.fontePagadoraCpf ?? undefined,
                      valorBruto: String(item.valorBruto),
                      competencia: item.competencia.slice(0, 10),
                    },
                  })
                }
                onLongPress={() => confirmarExclusao('rendimento', item.id)}>
                <ThemedText type="small">{item.tipo}</ThemedText>
                <ThemedText type="small">{formatMoeda(item.valorBruto)}</ThemedText>
              </Pressable>
            ))}
          </ThemedView>

          <ThemedView style={styles.secao}>
            <ThemedView style={styles.secaoHeader}>
              <ThemedText type="smallBold">Deduções</ThemedText>
              <Pressable onPress={() => router.push('/lancar-deducao')}>
                <ThemedText type="smallBold">+</ThemedText>
              </Pressable>
            </ThemedView>
            {deducoes.map((item: DeducaoCarneLeao) => (
              <Pressable
                key={item.id}
                style={styles.item}
                onPress={() =>
                  router.push({
                    pathname: '/lancar-deducao',
                    params: {
                      id: item.id,
                      tipo: item.tipo,
                      valor: String(item.valor),
                      anexoUrl: item.anexoUrl ?? undefined,
                      competencia: item.competencia.slice(0, 10),
                    },
                  })
                }
                onLongPress={() => confirmarExclusao('deducao', item.id)}>
                <ThemedText type="small">{item.tipo}</ThemedText>
                <ThemedText type="small">{formatMoeda(item.valor)}</ThemedText>
              </Pressable>
            ))}
          </ThemedView>

          <ThemedView style={styles.secao}>
            <ThemedView style={styles.secaoHeader}>
              <ThemedText type="smallBold">Livro-caixa</ThemedText>
              <Pressable onPress={() => router.push('/lancar-livro-caixa')}>
                <ThemedText type="smallBold">+</ThemedText>
              </Pressable>
            </ThemedView>
            {livroCaixa.map((item: LivroCaixaLancamento) => (
              <Pressable
                key={item.id}
                style={styles.item}
                onPress={() =>
                  router.push({
                    pathname: '/lancar-livro-caixa',
                    params: {
                      id: item.id,
                      descricao: item.descricao,
                      categoria: item.categoria,
                      valor: String(item.valor),
                      competencia: item.competencia.slice(0, 10),
                    },
                  })
                }
                onLongPress={() => confirmarExclusao('livro-caixa', item.id)}>
                <ThemedText type="small">{item.descricao}</ThemedText>
                <ThemedText type="small">{formatMoeda(item.valor)}</ThemedText>
              </Pressable>
            ))}
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset,
    gap: Spacing.three,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  list: { gap: Spacing.three },
  card: {
    borderWidth: 1,
    borderColor: '#8888',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  secao: { gap: Spacing.two },
  secaoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#8888',
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
});
