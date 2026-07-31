import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useEmpresaMes } from '@/hooks/use-empresa-mes';
import {
  deleteDistribuicaoLucros,
  deleteFaturamento,
  deleteProLabore,
  type DistribuicaoLucros,
  type ProLabore,
} from '@/lib/pj-api';
import { BottomTabInset, Spacing } from '@/constants/theme';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatMoeda(valor: number): string {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`;
}

function alertaLabel(alerta: string): string {
  if (alerta === 'atencao_80pct') return 'atenção: você já atingiu 80% do limite anual do MEI';
  if (alerta === 'excedeu_20pct') return 'você excedeu o limite anual do MEI (até 20% acima)';
  if (alerta === 'excedeu_mais_20pct') {
    return 'você excedeu o limite anual do MEI em mais de 20% — risco de desenquadramento retroativo';
  }
  return '';
}

function competenciaAAAAMMDD(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-01`;
}

export default function EmpresaScreen() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const {
    empresa,
    faturamento,
    das,
    limiteMei,
    proLabores,
    distribuicoes,
    isLoading,
    error,
    refetch,
  } = useEmpresaMes(ano, mes);

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

  const confirmarExclusao = (tipo: 'faturamento' | 'pro-labore' | 'distribuicao', id: string) => {
    Alert.alert('Excluir lançamento', 'Tem certeza que deseja excluir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            if (tipo === 'faturamento') await deleteFaturamento(id);
            if (tipo === 'pro-labore') await deleteProLabore(id);
            if (tipo === 'distribuicao') await deleteDistribuicaoLucros(id);
            await refetch();
          } catch {
            Alert.alert('Erro', 'não foi possível excluir o lançamento.');
          }
        },
      },
    ]);
  };

  if (!isLoading && !empresa) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title">Empresa</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            você ainda não cadastrou nenhuma empresa.
          </ThemedText>
          <Pressable onPress={() => router.push('/cadastrar-empresa')} style={styles.button}>
            <ThemedText type="smallBold">cadastrar empresa</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

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
          <ThemedText themeColor="expense">erro ao carregar empresa: {error.message}</ThemedText>
        )}

        {empresa && (
          <ScrollView contentContainerStyle={styles.list}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/cadastrar-empresa',
                  params: {
                    id: empresa.id,
                    cnpj: empresa.cnpj,
                    nome: empresa.nome,
                    regime: empresa.regime,
                    atividadeTipo: empresa.atividadeTipo,
                    anexoSimples: empresa.anexoSimples ?? undefined,
                    dataAbertura: empresa.dataAbertura.slice(0, 10),
                  },
                })
              }>
              <ThemedText type="small" themeColor="textSecondary">
                {empresa.nome} · {empresa.regime === 'MEI' ? 'MEI' : `Simples (Anexo ${empresa.anexoSimples})`}
              </ThemedText>
            </Pressable>

            <ThemedView style={styles.secao}>
              <ThemedView style={styles.secaoHeader}>
                <ThemedText type="smallBold">Faturamento do mês</ThemedText>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/lancar-faturamento',
                      params: faturamento
                        ? {
                            id: faturamento.id,
                            empresaId: empresa.id,
                            receitaBrutaTotal: String(faturamento.receitaBrutaTotal),
                            competencia: faturamento.competencia.slice(0, 10),
                          }
                        : { empresaId: empresa.id, competencia: competenciaAAAAMMDD(ano, mes) },
                    })
                  }
                  onLongPress={() =>
                    faturamento && confirmarExclusao('faturamento', faturamento.id)
                  }>
                  <ThemedText type="smallBold">{faturamento ? 'editar' : '+'}</ThemedText>
                </Pressable>
              </ThemedView>
              {faturamento ? (
                <ThemedText type="small">{formatMoeda(faturamento.receitaBrutaTotal)}</ThemedText>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  nenhum faturamento lançado este mês
                </ThemedText>
              )}
            </ThemedView>

            <ThemedView style={styles.card}>
              {das ? (
                <>
                  <ThemedText type="smallBold" themeColor="expense">
                    DAS devido: {formatMoeda(das.valorDevido)}
                  </ThemedText>
                  <ThemedText type="small">Vencimento: {das.vencimento.slice(0, 10)}</ThemedText>
                  {empresa.regime === 'SIMPLES_ME' &&
                    typeof das.detalheCalculo.rbt12 === 'number' && (
                      <ThemedText type="small">
                        RBT12: {formatMoeda(das.detalheCalculo.rbt12)}
                      </ThemedText>
                    )}
                </>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  sem apuração de DAS este mês
                </ThemedText>
              )}
            </ThemedView>

            {empresa.regime === 'MEI' && limiteMei && (
              <ThemedView style={styles.card}>
                <ThemedText type="smallBold">Limite anual MEI</ThemedText>
                <ThemedText type="small">
                  {formatMoeda(limiteMei.receitaAcumuladaAno)} de{' '}
                  {formatMoeda(limiteMei.limiteProporcional)} (
                  {(limiteMei.percentualAtingido * 100).toFixed(1)}%)
                </ThemedText>
                {limiteMei.alerta !== 'ok' && (
                  <ThemedText type="small" themeColor="expense">
                    {alertaLabel(limiteMei.alerta)}
                  </ThemedText>
                )}
              </ThemedView>
            )}

            <ThemedView style={styles.secao}>
              <ThemedView style={styles.secaoHeader}>
                <ThemedText type="smallBold">Pró-labore</ThemedText>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/lancar-pro-labore',
                      params: { empresaId: empresa.id, competencia: competenciaAAAAMMDD(ano, mes) },
                    })
                  }>
                  <ThemedText type="smallBold">+</ThemedText>
                </Pressable>
              </ThemedView>
              {proLabores.map((item: ProLabore) => (
                <Pressable
                  key={item.id}
                  style={styles.item}
                  onPress={() =>
                    router.push({
                      pathname: '/lancar-pro-labore',
                      params: {
                        id: item.id,
                        empresaId: empresa.id,
                        valor: String(item.valor),
                        inssRetido: String(item.inssRetido),
                        competencia: item.competencia.slice(0, 10),
                      },
                    })
                  }
                  onLongPress={() => confirmarExclusao('pro-labore', item.id)}>
                  <ThemedText type="small">{formatMoeda(item.valor)}</ThemedText>
                  <ThemedText type="small">IRRF: {formatMoeda(item.irrfRetido)}</ThemedText>
                </Pressable>
              ))}
            </ThemedView>

            <ThemedView style={styles.secao}>
              <ThemedView style={styles.secaoHeader}>
                <ThemedText type="smallBold">Distribuição de lucros</ThemedText>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/lancar-distribuicao-lucros',
                      params: { empresaId: empresa.id, competencia: competenciaAAAAMMDD(ano, mes) },
                    })
                  }>
                  <ThemedText type="smallBold">+</ThemedText>
                </Pressable>
              </ThemedView>
              {distribuicoes.map((item: DistribuicaoLucros) => (
                <Pressable
                  key={item.id}
                  style={styles.item}
                  onPress={() =>
                    router.push({
                      pathname: '/lancar-distribuicao-lucros',
                      params: {
                        id: item.id,
                        empresaId: empresa.id,
                        valor: String(item.valor),
                        competencia: item.competencia.slice(0, 10),
                      },
                    })
                  }
                  onLongPress={() => confirmarExclusao('distribuicao', item.id)}>
                  <ThemedText type="small">{formatMoeda(item.valor)}</ThemedText>
                  <ThemedText type="small">{item.isento ? 'isento' : 'não isento'}</ThemedText>
                </Pressable>
              ))}
            </ThemedView>
          </ScrollView>
        )}
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
  button: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
  },
});
