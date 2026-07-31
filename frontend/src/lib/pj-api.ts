import { apiDelete, apiPatch, apiPost } from '@/lib/api';

export type RegimeEmpresa = 'MEI' | 'SIMPLES_ME';
export type AtividadeEmpresa = 'COMERCIO' | 'INDUSTRIA' | 'SERVICO' | 'COMERCIO_SERVICO';
export type AnexoSimples = 'I' | 'II' | 'III' | 'IV' | 'V';
export type EmissorTipo = 'CPF' | 'CNPJ';

export interface Empresa {
  id: string;
  cnpj: string;
  nome: string;
  regime: RegimeEmpresa;
  atividadeTipo: AtividadeEmpresa;
  anexoSimples: AnexoSimples | null;
  dataAbertura: string;
  ativa: boolean;
}

export interface EmpresaInput {
  cnpj: string;
  nome: string;
  regime: RegimeEmpresa;
  atividadeTipo: AtividadeEmpresa;
  anexoSimples?: AnexoSimples;
  dataAbertura: string;
}

export interface FaturamentoMensalPJ {
  id: string;
  empresaId: string;
  competencia: string;
  receitaBrutaTotal: number;
  receitaComNota: number | null;
  receitaSemNota: number | null;
  clienteTipoPredominante: EmissorTipo | null;
}

export interface FaturamentoMensalPjInput {
  empresaId: string;
  receitaBrutaTotal: number;
  receitaComNota?: number;
  receitaSemNota?: number;
  clienteTipoPredominante?: EmissorTipo;
  competencia: string;
}

export type UpdateFaturamentoMensalPjInput = Partial<
  Pick<
    FaturamentoMensalPjInput,
    'receitaBrutaTotal' | 'receitaComNota' | 'receitaSemNota' | 'clienteTipoPredominante'
  >
>;

export interface ProLabore {
  id: string;
  empresaId: string;
  competencia: string;
  valor: number;
  inssRetido: number;
  irrfRetido: number;
}

export interface ProLaboreInput {
  empresaId: string;
  valor: number;
  inssRetido: number;
  competencia: string;
}

export interface DistribuicaoLucros {
  id: string;
  empresaId: string;
  competencia: string;
  valor: number;
  isento: boolean;
  impostoRetido: number;
}

export interface DistribuicaoLucrosInput {
  empresaId: string;
  valor: number;
  competencia: string;
}

export interface DASApuracao {
  id: string;
  competencia: string;
  regimeNoMomento: RegimeEmpresa;
  valorDevido: number;
  detalheCalculo: Record<string, unknown>;
  vencimento: string;
  status: 'PENDENTE' | 'PAGO' | 'ATRASADO';
}

export interface AcompanhamentoLimiteMei {
  id: string;
  anoCalendario: number;
  limiteProporcional: number;
  receitaAcumuladaAno: number;
  percentualAtingido: number;
  alerta: 'ok' | 'atencao_80pct' | 'excedeu_20pct' | 'excedeu_mais_20pct';
}

export function createEmpresa(input: EmpresaInput): Promise<Empresa> {
  return apiPost<Empresa>('/empresas', input);
}

export function updateEmpresa(id: string, input: Partial<EmpresaInput>): Promise<Empresa> {
  return apiPatch<Empresa>(`/empresas/${id}`, input);
}

export function deleteEmpresa(id: string): Promise<void> {
  return apiDelete<void>(`/empresas/${id}`);
}

export function createFaturamento(input: FaturamentoMensalPjInput): Promise<FaturamentoMensalPJ> {
  return apiPost<FaturamentoMensalPJ>('/faturamentos-pj', input);
}

export function updateFaturamento(
  id: string,
  input: UpdateFaturamentoMensalPjInput,
): Promise<FaturamentoMensalPJ> {
  return apiPatch<FaturamentoMensalPJ>(`/faturamentos-pj/${id}`, input);
}

export function deleteFaturamento(id: string): Promise<void> {
  return apiDelete<void>(`/faturamentos-pj/${id}`);
}

export function createProLabore(input: ProLaboreInput): Promise<ProLabore> {
  return apiPost<ProLabore>('/pro-labores', input);
}

export function updateProLabore(
  id: string,
  input: Partial<ProLaboreInput>,
): Promise<ProLabore> {
  return apiPatch<ProLabore>(`/pro-labores/${id}`, input);
}

export function deleteProLabore(id: string): Promise<void> {
  return apiDelete<void>(`/pro-labores/${id}`);
}

export function createDistribuicaoLucros(
  input: DistribuicaoLucrosInput,
): Promise<DistribuicaoLucros> {
  return apiPost<DistribuicaoLucros>('/distribuicoes-lucros', input);
}

export function updateDistribuicaoLucros(
  id: string,
  input: Partial<DistribuicaoLucrosInput>,
): Promise<DistribuicaoLucros> {
  return apiPatch<DistribuicaoLucros>(`/distribuicoes-lucros/${id}`, input);
}

export function deleteDistribuicaoLucros(id: string): Promise<void> {
  return apiDelete<void>(`/distribuicoes-lucros/${id}`);
}
