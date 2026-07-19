import { ParametroFiscalPfDados } from './parametro-fiscal-pf.service';

// Fonte: Receita Federal, tabelas oficiais 2026
// https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026
// Faixa de isenção efetiva (pós-redutor da Lei 15.270/2025) e faixa de
// redução parcial confirmadas via Ministério da Fazenda / Secom, 2026-01.
export const PARAMETRO_FISCAL_PF_2026: ParametroFiscalPfDados = {
  faixaIsencaoMensal: 5000.0,
  faixaReducaoAte: 7350.0,
  tetoEducacaoAnual: 3561.5,
  valorDependenteMensal: 189.59,
  descontoSimplificadoMensal: 607.2,
  limiteObrigatoriedadeDeclaracao: 35584.0,
  tabelaProgressivaMensal: [
    { ate: 2428.8, aliquota: 0, parcelaDeduzir: 0 },
    { ate: 2826.65, aliquota: 0.075, parcelaDeduzir: 182.16 },
    { ate: 3751.05, aliquota: 0.15, parcelaDeduzir: 394.16 },
    { ate: 4664.68, aliquota: 0.225, parcelaDeduzir: 675.49 },
    { ate: 999999999, aliquota: 0.275, parcelaDeduzir: 908.73 },
  ],
};
