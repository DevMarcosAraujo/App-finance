import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { apiGet } from '@/lib/api';
import type {
  ApuracaoCarneLeao,
  DeducaoCarneLeao,
  LivroCaixaLancamento,
  RendimentoAutonomo,
} from '@/lib/carne-leao-api';

interface UseCarneLeaoMesResult {
  rendimentos: RendimentoAutonomo[];
  deducoes: DeducaoCarneLeao[];
  livroCaixa: LivroCaixaLancamento[];
  apuracao: ApuracaoCarneLeao | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useCarneLeaoMes(ano: number, mes: number): UseCarneLeaoMesResult {
  const [rendimentos, setRendimentos] = useState<RendimentoAutonomo[]>([]);
  const [deducoes, setDeducoes] = useState<DeducaoCarneLeao[]>([]);
  const [livroCaixa, setLivroCaixa] = useState<LivroCaixaLancamento[]>([]);
  const [apuracao, setApuracao] = useState<ApuracaoCarneLeao | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);

  const fetchTudo = useCallback(async (): Promise<void> => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const query = `?ano=${ano}&mes=${mes}`;
      const [rendimentosResult, deducoesResult, livroCaixaResult, apuracaoResult] =
        await Promise.all([
          apiGet<RendimentoAutonomo[]>(`/rendimentos-autonomos${query}`),
          apiGet<DeducaoCarneLeao[]>(`/deducoes-carne-leao${query}`),
          apiGet<LivroCaixaLancamento[]>(`/livro-caixa${query}`),
          apiGet<ApuracaoCarneLeao | null>(`/apuracoes-carne-leao${query}`),
        ]);
      if (requestIdRef.current === requestId) {
        setRendimentos(rendimentosResult);
        setDeducoes(deducoesResult);
        setLivroCaixa(livroCaixaResult);
        setApuracao(apuracaoResult);
      }
    } catch (err) {
      if (requestIdRef.current === requestId) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [ano, mes]);

  useFocusEffect(
    useCallback(() => {
      fetchTudo();
    }, [fetchTudo]),
  );

  return { rendimentos, deducoes, livroCaixa, apuracao, isLoading, error, refetch: fetchTudo };
}
