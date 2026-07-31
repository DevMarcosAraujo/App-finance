import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { apiGet } from '@/lib/api';
import type {
  AcompanhamentoLimiteMei,
  DASApuracao,
  DistribuicaoLucros,
  Empresa,
  FaturamentoMensalPJ,
  ProLabore,
} from '@/lib/pj-api';

interface UseEmpresaMesResult {
  empresa: Empresa | null;
  faturamento: FaturamentoMensalPJ | null;
  das: DASApuracao | null;
  limiteMei: AcompanhamentoLimiteMei | null;
  proLabores: ProLabore[];
  distribuicoes: DistribuicaoLucros[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useEmpresaMes(ano: number, mes: number): UseEmpresaMesResult {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [faturamento, setFaturamento] = useState<FaturamentoMensalPJ | null>(null);
  const [das, setDas] = useState<DASApuracao | null>(null);
  const [limiteMei, setLimiteMei] = useState<AcompanhamentoLimiteMei | null>(null);
  const [proLabores, setProLabores] = useState<ProLabore[]>([]);
  const [distribuicoes, setDistribuicoes] = useState<DistribuicaoLucros[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);

  const fetchTudo = useCallback(async (): Promise<void> => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const empresas = await apiGet<Empresa[]>('/empresas');
      const primeiraEmpresa = empresas.find((e) => e.ativa) ?? null;

      if (!primeiraEmpresa) {
        if (requestIdRef.current === requestId) {
          setEmpresa(null);
          setFaturamento(null);
          setDas(null);
          setLimiteMei(null);
          setProLabores([]);
          setDistribuicoes([]);
        }
        return;
      }

      const query = `?empresaId=${primeiraEmpresa.id}&ano=${ano}&mes=${mes}`;
      const [faturamentoResult, dasResult, proLaboresResult, distribuicoesResult, limiteMeiResult] =
        await Promise.all([
          apiGet<FaturamentoMensalPJ[]>(`/faturamentos-pj${query}`),
          apiGet<DASApuracao | null>(`/das-apuracoes${query}`),
          apiGet<ProLabore[]>(`/pro-labores${query}`),
          apiGet<DistribuicaoLucros[]>(`/distribuicoes-lucros${query}`),
          primeiraEmpresa.regime === 'MEI'
            ? apiGet<AcompanhamentoLimiteMei | null>(
                `/acompanhamento-limite-mei?empresaId=${primeiraEmpresa.id}&ano=${ano}`,
              )
            : Promise.resolve(null),
        ]);

      if (requestIdRef.current === requestId) {
        setEmpresa(primeiraEmpresa);
        setFaturamento(faturamentoResult[0] ?? null);
        setDas(dasResult);
        setProLabores(proLaboresResult);
        setDistribuicoes(distribuicoesResult);
        setLimiteMei(limiteMeiResult);
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

  return {
    empresa,
    faturamento,
    das,
    limiteMei,
    proLabores,
    distribuicoes,
    isLoading,
    error,
    refetch: fetchTudo,
  };
}
