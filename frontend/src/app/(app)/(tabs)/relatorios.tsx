import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRelatorios } from '@/hooks/use-relatorios';
import { useTheme } from '@/hooks/use-theme';
import {
  baixarRelatorioBlob,
  gerarRelatorio,
  type RelatorioGerado,
  type TipoRelatorio,
} from '@/lib/relatorios-api';
import { BottomTabInset, Spacing } from '@/constants/theme';

const TIPOS: { valor: TipoRelatorio; label: string }[] = [
  { valor: 'MENSAL', label: 'Mensal' },
  { valor: 'BIMESTRAL', label: 'Bimestral' },
  { valor: 'SEMESTRAL', label: 'Semestral' },
  { valor: 'ANUAL', label: 'Anual' },
];

function calcularPeriodo(
  tipo: TipoRelatorio,
  ano: number,
  mes: number,
): { periodoInicio: string; periodoFim: string } {
  const duracaoMeses = { MENSAL: 1, BIMESTRAL: 2, SEMESTRAL: 6, ANUAL: 12 }[tipo];
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes - 1 + duracaoMeses, 1));
  return {
    periodoInicio: inicio.toISOString().slice(0, 10),
    periodoFim: fim.toISOString().slice(0, 10),
  };
}

function formatPeriodo(relatorio: RelatorioGerado): string {
  const inicio = relatorio.periodoInicio.slice(0, 10);
  const fim = new Date(relatorio.periodoFim);
  fim.setUTCDate(fim.getUTCDate() - 1);
  return `${inicio} a ${fim.toISOString().slice(0, 10)}`;
}

async function salvarEcompartilhar(id: string, nomeArquivo: string): Promise<void> {
  const blob = await baixarRelatorioBlob(id);

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return;
  }

  const caminho = `${FileSystem.cacheDirectory}${nomeArquivo}`;
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  await FileSystem.writeAsStringAsync(caminho, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(caminho);
}

export default function RelatoriosScreen() {
  const theme = useTheme();
  const hoje = new Date();
  const [tipo, setTipo] = useState<TipoRelatorio>('MENSAL');
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [isGenerating, setIsGenerating] = useState(false);
  const { relatorios, isLoading, error, refetch } = useRelatorios();

  const gerar = async () => {
    setIsGenerating(true);
    let relatorio: RelatorioGerado;
    try {
      const { periodoInicio, periodoFim } = calcularPeriodo(tipo, ano, mes);
      relatorio = await gerarRelatorio({ tipo, periodoInicio, periodoFim });
      await refetch();
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o relatório.');
      setIsGenerating(false);
      return;
    }

    try {
      await salvarEcompartilhar(relatorio.id, `relatorio-${relatorio.id}.pdf`);
    } catch {
      Alert.alert(
        'Relatório gerado',
        'O relatório foi gerado, mas não foi possível baixá-lo agora. Você pode baixá-lo novamente na lista abaixo.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const baixarNovamente = async (relatorio: RelatorioGerado) => {
    try {
      await salvarEcompartilhar(relatorio.id, `relatorio-${relatorio.id}.pdf`);
    } catch {
      Alert.alert('Erro', 'Não foi possível baixar o relatório.');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Relatórios</ThemedText>

        <ThemedView style={styles.tiposRow}>
          {TIPOS.map((item) => (
            <Pressable key={item.valor} onPress={() => setTipo(item.valor)}>
              <ThemedView
                type={tipo === item.valor ? 'accentSoft' : 'backgroundElement'}
                style={styles.tipoChip}>
                <ThemedText
                  type="small"
                  themeColor={tipo === item.valor ? 'accent' : 'textSecondary'}>
                  {item.label}
                </ThemedText>
              </ThemedView>
            </Pressable>
          ))}
        </ThemedView>

        <ThemedView style={styles.periodoRow}>
          <Pressable onPress={() => (mes === 1 ? (setAno(ano - 1), setMes(12)) : setMes(mes - 1))}>
            <ThemedText type="smallBold">◀</ThemedText>
          </Pressable>
          <ThemedText type="default">
            {mes}/{ano}
          </ThemedText>
          <Pressable onPress={() => (mes === 12 ? (setAno(ano + 1), setMes(1)) : setMes(mes + 1))}>
            <ThemedText type="smallBold">▶</ThemedText>
          </Pressable>
        </ThemedView>

        <Pressable
          onPress={gerar}
          disabled={isGenerating}
          style={[styles.gerarBotao, { backgroundColor: theme.accent }]}>
          <ThemedText type="smallBold" themeColor="background">
            {isGenerating ? 'Gerando...' : 'Gerar relatório'}
          </ThemedText>
        </Pressable>

        <ScrollView
          style={styles.historicoScroll}
          contentContainerStyle={styles.historicoScrollContent}
          showsVerticalScrollIndicator={false}>
          {isLoading && <ThemedText type="small">carregando histórico...</ThemedText>}
          {error && (
            <ThemedText themeColor="textSecondary">
              erro ao carregar histórico: {error.message}
            </ThemedText>
          )}

          {relatorios.map((relatorio) => (
            <Pressable key={relatorio.id} onPress={() => baixarNovamente(relatorio)}>
              <ThemedView type="accentSoft" style={styles.historicoItem}>
                <ThemedText type="smallBold">{relatorio.tipo}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatPeriodo(relatorio)}
                </ThemedText>
              </ThemedView>
            </Pressable>
          ))}
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
  tiposRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tipoChip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
  },
  periodoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
  },
  gerarBotao: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  historicoScroll: {
    flex: 1,
  },
  historicoScrollContent: {
    gap: Spacing.two,
  },
  historicoItem: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.half,
  },
});
