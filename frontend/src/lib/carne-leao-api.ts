import { apiDelete, apiPatch, apiPost } from '@/lib/api';

export type TipoRendimentoAutonomo = 'HONORARIO' | 'ALUGUEL_PF' | 'PENSAO_RECEBIDA' | 'EXTERIOR';
export type TipoDeducaoCarneLeao = 'INSS_AUTONOMO' | 'PENSAO_JUDICIAL' | 'PGBL';

export interface RendimentoAutonomo {
  id: string;
  tipo: TipoRendimentoAutonomo;
  fontePagadoraCpf: string | null;
  valorBruto: number;
  documentoFiscalId: string | null;
  competencia: string;
}

export interface RendimentoAutonomoInput {
  tipo: TipoRendimentoAutonomo;
  fontePagadoraCpf?: string;
  valorBruto: number;
  documentoFiscalId?: string;
  competencia: string;
}

export interface DeducaoCarneLeao {
  id: string;
  tipo: TipoDeducaoCarneLeao;
  valor: number;
  anexoUrl: string | null;
  competencia: string;
}

export interface DeducaoCarneLeaoInput {
  tipo: TipoDeducaoCarneLeao;
  valor: number;
  anexoUrl?: string;
  competencia: string;
}

export interface LivroCaixaLancamento {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  competencia: string;
}

export interface LivroCaixaInput {
  descricao: string;
  categoria: string;
  valor: number;
  competencia: string;
}

export interface ApuracaoCarneLeao {
  id: string;
  rendimentoBrutoTotal: number;
  deducoesTotal: number;
  baseCalculo: number;
  aliquotaEfetiva: number;
  impostoDevido: number;
  codigoReceita: string;
  vencimento: string;
  status: 'PENDENTE' | 'PAGO' | 'ATRASADO';
  calculoIncerto: boolean;
}

export function createRendimento(input: RendimentoAutonomoInput): Promise<RendimentoAutonomo> {
  return apiPost<RendimentoAutonomo>('/rendimentos-autonomos', input);
}

export function updateRendimento(
  id: string,
  input: Partial<RendimentoAutonomoInput>,
): Promise<RendimentoAutonomo> {
  return apiPatch<RendimentoAutonomo>(`/rendimentos-autonomos/${id}`, input);
}

export function deleteRendimento(id: string): Promise<void> {
  return apiDelete<void>(`/rendimentos-autonomos/${id}`);
}

export function createDeducao(input: DeducaoCarneLeaoInput): Promise<DeducaoCarneLeao> {
  return apiPost<DeducaoCarneLeao>('/deducoes-carne-leao', input);
}

export function updateDeducao(
  id: string,
  input: Partial<DeducaoCarneLeaoInput>,
): Promise<DeducaoCarneLeao> {
  return apiPatch<DeducaoCarneLeao>(`/deducoes-carne-leao/${id}`, input);
}

export function deleteDeducao(id: string): Promise<void> {
  return apiDelete<void>(`/deducoes-carne-leao/${id}`);
}

export function createLivroCaixa(input: LivroCaixaInput): Promise<LivroCaixaLancamento> {
  return apiPost<LivroCaixaLancamento>('/livro-caixa', input);
}

export function updateLivroCaixa(
  id: string,
  input: Partial<LivroCaixaInput>,
): Promise<LivroCaixaLancamento> {
  return apiPatch<LivroCaixaLancamento>(`/livro-caixa/${id}`, input);
}

export function deleteLivroCaixa(id: string): Promise<void> {
  return apiDelete<void>(`/livro-caixa/${id}`);
}
