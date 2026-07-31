import { AnexoSimples } from '@prisma/client';
import { FaixaSimples } from './anexo-simples-tabela.service';

// Fonte: tabela oficial dos Anexos I-V do Simples Nacional (LC 123/2006,
// arts. 18 e 19, com as faixas trazidas pela LC 155/2016 — inalteradas
// desde então, sem mudança de faixa/alíquota/dedução para 2026).
export const ANEXOS_SIMPLES_2026: { anexo: AnexoSimples; faixas: FaixaSimples[] }[] = [
  {
    anexo: AnexoSimples.I,
    faixas: [
      { rbt12Ate: 180000, aliquota: 0.04, parcelaDeduzir: 0 },
      { rbt12Ate: 360000, aliquota: 0.073, parcelaDeduzir: 5940 },
      { rbt12Ate: 720000, aliquota: 0.095, parcelaDeduzir: 13860 },
      { rbt12Ate: 1800000, aliquota: 0.107, parcelaDeduzir: 22500 },
      { rbt12Ate: 3600000, aliquota: 0.143, parcelaDeduzir: 87300 },
      { rbt12Ate: 4800000, aliquota: 0.19, parcelaDeduzir: 378000 },
    ],
  },
  {
    anexo: AnexoSimples.II,
    faixas: [
      { rbt12Ate: 180000, aliquota: 0.045, parcelaDeduzir: 0 },
      { rbt12Ate: 360000, aliquota: 0.078, parcelaDeduzir: 5940 },
      { rbt12Ate: 720000, aliquota: 0.1, parcelaDeduzir: 13860 },
      { rbt12Ate: 1800000, aliquota: 0.112, parcelaDeduzir: 22500 },
      { rbt12Ate: 3600000, aliquota: 0.147, parcelaDeduzir: 85500 },
      { rbt12Ate: 4800000, aliquota: 0.3, parcelaDeduzir: 720000 },
    ],
  },
  {
    anexo: AnexoSimples.III,
    faixas: [
      { rbt12Ate: 180000, aliquota: 0.06, parcelaDeduzir: 0 },
      { rbt12Ate: 360000, aliquota: 0.112, parcelaDeduzir: 9360 },
      { rbt12Ate: 720000, aliquota: 0.135, parcelaDeduzir: 17640 },
      { rbt12Ate: 1800000, aliquota: 0.16, parcelaDeduzir: 35640 },
      { rbt12Ate: 3600000, aliquota: 0.21, parcelaDeduzir: 125640 },
      { rbt12Ate: 4800000, aliquota: 0.33, parcelaDeduzir: 648000 },
    ],
  },
  {
    anexo: AnexoSimples.IV,
    faixas: [
      { rbt12Ate: 180000, aliquota: 0.045, parcelaDeduzir: 0 },
      { rbt12Ate: 360000, aliquota: 0.09, parcelaDeduzir: 8100 },
      { rbt12Ate: 720000, aliquota: 0.102, parcelaDeduzir: 12420 },
      { rbt12Ate: 1800000, aliquota: 0.14, parcelaDeduzir: 39780 },
      { rbt12Ate: 3600000, aliquota: 0.22, parcelaDeduzir: 183780 },
      { rbt12Ate: 4800000, aliquota: 0.33, parcelaDeduzir: 828000 },
    ],
  },
  {
    anexo: AnexoSimples.V,
    faixas: [
      { rbt12Ate: 180000, aliquota: 0.155, parcelaDeduzir: 0 },
      { rbt12Ate: 360000, aliquota: 0.18, parcelaDeduzir: 4500 },
      { rbt12Ate: 720000, aliquota: 0.195, parcelaDeduzir: 9900 },
      { rbt12Ate: 1800000, aliquota: 0.205, parcelaDeduzir: 17100 },
      { rbt12Ate: 3600000, aliquota: 0.23, parcelaDeduzir: 62100 },
      { rbt12Ate: 4800000, aliquota: 0.305, parcelaDeduzir: 540000 },
    ],
  },
];
