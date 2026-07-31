import { ParametroFiscalPjDados } from './parametro-fiscal-pj.service';

// Fontes: Portal do Empreendedor (gov.br) para limite/DAS do MEI; lei do
// Imposto de Renda 2026 (mesma reforma citada no ApuracaoMensalCarneLeao)
// para o limite de isenção mensal da distribuição de lucros. A alíquota
// sobre o excedente (retenção de 10% acima de R$50.000/mês por sócio,
// vigente desde jan/2026) está registrada aqui mas ainda NÃO é aplicada
// pelo DistribuicaoLucrosService — fica para uma task futura decidida à
// parte, ver `modulo_pj_implementation_status` na memória do projeto.
export const PARAMETRO_FISCAL_PJ_2026: ParametroFiscalPjDados = {
  meiLimiteAnual: 81000,
  meiDasComercioIndustria: 82.05,
  meiDasServicos: 86.05,
  meiDasComercioServicos: 87.05,
  limiteDividendoIsentoMensal: 50000,
  aliquotaDividendoExcedente: 0.1,
};
