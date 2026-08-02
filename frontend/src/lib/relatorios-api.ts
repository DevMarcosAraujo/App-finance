// frontend/src/lib/relatorios-api.ts
import { apiGet, apiGetBlob, apiPost } from '@/lib/api';

export type TipoRelatorio = 'MENSAL' | 'BIMESTRAL' | 'SEMESTRAL' | 'ANUAL';

export interface RelatorioGerado {
  id: string;
  tipo: TipoRelatorio;
  periodoInicio: string;
  periodoFim: string;
  arquivoPdfUrl: string;
  geradoEm: string;
}

export interface GerarRelatorioInput {
  tipo: TipoRelatorio;
  periodoInicio: string;
  periodoFim: string;
}

export function gerarRelatorio(
  input: GerarRelatorioInput,
): Promise<RelatorioGerado> {
  return apiPost<RelatorioGerado>('/relatorios', input);
}

export function listarRelatorios(): Promise<RelatorioGerado[]> {
  return apiGet<RelatorioGerado[]>('/relatorios');
}

export function baixarRelatorioBlob(id: string): Promise<Blob> {
  return apiGetBlob(`/relatorios/${id}/arquivo`);
}
