// frontend/src/lib/transacoes-api.ts
import { apiDelete, apiPatch, apiPost } from '@/lib/api';

export type TransacaoTipo = 'RECEITA' | 'DESPESA';

export interface Categoria {
  id: string;
  nome: string;
  cor: string | null;
  icone: string | null;
}

export interface Transacao {
  id: string;
  tipo: TransacaoTipo;
  valor: number;
  categoria: Categoria | null;
  descricao: string | null;
  data: string;
  usuarioId: string;
}

export interface TransacaoInput {
  tipo: TransacaoTipo;
  valor: number;
  categoriaId?: string;
  descricao?: string;
  data: string;
}

export function createTransacao(input: TransacaoInput): Promise<Transacao> {
  return apiPost<Transacao>('/transacoes', input);
}

export function updateTransacao(
  id: string,
  input: Partial<TransacaoInput>,
): Promise<Transacao> {
  return apiPatch<Transacao>(`/transacoes/${id}`, input);
}

export function deleteTransacao(id: string): Promise<void> {
  return apiDelete<void>(`/transacoes/${id}`);
}
