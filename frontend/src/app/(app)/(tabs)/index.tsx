import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTransacoes } from '@/hooks/use-transacoes';
import { deleteTransacao, type Transacao } from '@/lib/transacoes-api';
import { BottomTabInset, Spacing } from '@/constants/theme';

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function formatValor(valor: number, tipo: Transacao['tipo']): string {
  const sinal = tipo === 'DESPESA' ? '-' : '+';
  return `${sinal} R$ ${valor.toFixed(2).replace('.', ',')}`;
}

export default function HomeScreen() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const { transacoes, isLoading, error, refetch } = useTransacoes(ano, mes);

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

  const confirmarExclusao = (id: string) => {
    Alert.alert(
      'Excluir transação',
      'Tem certeza que deseja excluir esta transação?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteTransacao(id);
            await refetch();
          },
        },
      ],
    );
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
          <ThemedText themeColor="textSecondary">
            erro ao carregar transações: {error.message}
          </ThemedText>
        )}

        <FlatList
          data={transacoes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            !isLoading ? (
              <ThemedText type="small" themeColor="textSecondary">
                nenhuma transação em {MESES[mes - 1].toLowerCase()}
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/nova-transacao',
                  params: {
                    id: item.id,
                    tipo: item.tipo,
                    valor: String(item.valor),
                    categoriaId: item.categoria?.id,
                    descricao: item.descricao ?? undefined,
                    data: item.data.slice(0, 10),
                  },
                })
              }
              onLongPress={() => confirmarExclusao(item.id)}
              style={styles.item}>
              <ThemedView style={styles.itemInfo}>
                <ThemedText type="smallBold">
                  {item.categoria?.nome ?? 'Sem categoria'}
                </ThemedText>
                {item.descricao && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.descricao}
                  </ThemedText>
                )}
              </ThemedView>
              <ThemedText
                type="smallBold"
                themeColor={item.tipo === 'DESPESA' ? 'expense' : 'income'}>
                {formatValor(item.valor, item.tipo)}
              </ThemedText>
            </Pressable>
          )}
        />

        <Pressable
          onPress={() => router.push('/nova-transacao')}
          style={styles.fab}>
          <ThemedText type="title" themeColor="background">
            +
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
    paddingBottom: BottomTabInset,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  list: {
    gap: Spacing.two,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#8888',
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  itemInfo: {
    gap: Spacing.half,
  },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: Spacing.four + BottomTabInset,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3c87f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
