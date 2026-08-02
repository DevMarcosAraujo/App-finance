// frontend/src/hooks/use-relatorios.ts
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { listarRelatorios, type RelatorioGerado } from '@/lib/relatorios-api';

interface UseRelatoriosResult {
  relatorios: RelatorioGerado[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useRelatorios(): UseRelatoriosResult {
  const [relatorios, setRelatorios] = useState<RelatorioGerado[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);

  const fetchRelatorios = useCallback(async (): Promise<void> => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listarRelatorios();
      if (requestIdRef.current === requestId) {
        setRelatorios(result);
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
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchRelatorios();
    }, [fetchRelatorios]),
  );

  return { relatorios, isLoading, error, refetch: fetchRelatorios };
}
