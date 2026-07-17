// frontend/src/hooks/use-transacoes.ts
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { apiGet } from '@/lib/api';
import type { Transacao } from '@/lib/transacoes-api';

interface UseTransacoesResult {
  transacoes: Transacao[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useTransacoes(ano: number, mes: number): UseTransacoesResult {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Guarda a request mais recente: se o mês mudar de novo (ou a tela ganhar
  // foco de novo) antes desta resolver, uma resposta atrasada não deve
  // sobrescrever o estado com dados de um mês que não é mais o exibido.
  const requestIdRef = useRef(0);

  const fetchTransacoes = useCallback(async (): Promise<void> => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiGet<Transacao[]>(
        `/transacoes?ano=${ano}&mes=${mes}`,
      );
      if (requestIdRef.current === requestId) {
        setTransacoes(result);
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
      fetchTransacoes();
    }, [fetchTransacoes]),
  );

  return { transacoes, isLoading, error, refetch: fetchTransacoes };
}
