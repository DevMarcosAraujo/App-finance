import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import { TipoRelatorio } from '@prisma/client';
import type { RelatorioAgregado } from './relatorio.service';

export interface RelatorioPdfDados {
  tipo: TipoRelatorio;
  periodoInicio: Date;
  periodoFim: Date;
  agregado: RelatorioAgregado;
}

const TIPO_LABEL: Record<TipoRelatorio, string> = {
  MENSAL: 'Mensal',
  BIMESTRAL: 'Bimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11 },
  titulo: { fontSize: 18, marginBottom: 4 },
  periodo: { fontSize: 11, marginBottom: 16, color: '#666' },
  totaisRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  totalItem: { flexDirection: 'column' },
  totalLabel: { fontSize: 9, color: '#666' },
  totalValor: { fontSize: 14, marginTop: 2 },
  tabelaHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 4,
    marginBottom: 4,
  },
  tabelaRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
  },
  colNome: { flex: 2 },
  colValor: { flex: 1, textAlign: 'right' },
  vazio: { marginTop: 16, color: '#666' },
});

function formatMoeda(valor: number): string {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`;
}

function formatData(data: Date): string {
  return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function RelatorioDocument({ tipo, periodoInicio, periodoFim, agregado }: RelatorioPdfDados) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(
        Text,
        { style: styles.titulo },
        `Relatório ${TIPO_LABEL[tipo]}`,
      ),
      React.createElement(
        Text,
        { style: styles.periodo },
        `${formatData(periodoInicio)} a ${formatData(periodoFim)}`,
      ),
      React.createElement(
        View,
        { style: styles.totaisRow },
        React.createElement(
          View,
          { style: styles.totalItem },
          React.createElement(Text, { style: styles.totalLabel }, 'Receitas'),
          React.createElement(Text, { style: styles.totalValor }, formatMoeda(agregado.totalReceitas)),
        ),
        React.createElement(
          View,
          { style: styles.totalItem },
          React.createElement(Text, { style: styles.totalLabel }, 'Despesas'),
          React.createElement(Text, { style: styles.totalValor }, formatMoeda(agregado.totalDespesas)),
        ),
        React.createElement(
          View,
          { style: styles.totalItem },
          React.createElement(Text, { style: styles.totalLabel }, 'Saldo'),
          React.createElement(Text, { style: styles.totalValor }, formatMoeda(agregado.saldo)),
        ),
      ),
      agregado.porCategoria.length === 0
        ? React.createElement(
            Text,
            { style: styles.vazio },
            'Nenhuma transação registrada neste período.',
          )
        : React.createElement(
            View,
            null,
            React.createElement(
              View,
              { style: styles.tabelaHeader },
              React.createElement(Text, { style: styles.colNome }, 'Categoria'),
              React.createElement(Text, { style: styles.colValor }, 'Receitas'),
              React.createElement(Text, { style: styles.colValor }, 'Despesas'),
            ),
            ...agregado.porCategoria.map((categoria) =>
              React.createElement(
                View,
                { key: categoria.categoriaId ?? 'sem-categoria', style: styles.tabelaRow },
                React.createElement(Text, { style: styles.colNome }, categoria.categoriaNome),
                React.createElement(Text, { style: styles.colValor }, formatMoeda(categoria.totalReceitas)),
                React.createElement(Text, { style: styles.colValor }, formatMoeda(categoria.totalDespesas)),
              ),
            ),
          ),
    ),
  );
}

export function renderRelatorioPdf(dados: RelatorioPdfDados): Promise<Buffer> {
  return renderToBuffer(RelatorioDocument(dados));
}
