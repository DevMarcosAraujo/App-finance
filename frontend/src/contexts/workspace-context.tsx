import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { apiGet, apiPost, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

export type PlanoTipo = 'INDIVIDUAL' | 'FAMILIA';

interface Workspace {
  id: string;
  nome: string;
  plano: { tipo: PlanoTipo };
}

interface WorkspaceContextValue {
  workspace: Workspace | null;
  isLoading: boolean;
  createWorkspace: (tipo: PlanoTipo) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { usuario } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWorkspace = useCallback(async () => {
    try {
      const result = await apiGet<Workspace>('/workspaces/me');
      setWorkspace(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setWorkspace(null);
      } else {
        throw err;
      }
    }
  }, []);

  useEffect(() => {
    if (!usuario) {
      setWorkspace(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    (async () => {
      try {
        await fetchWorkspace();
      } finally {
        setIsLoading(false);
      }
    })();
  }, [usuario, fetchWorkspace]);

  const createWorkspace = useCallback(async (tipo: PlanoTipo) => {
    const result = await apiPost<Workspace>('/workspaces', { tipo });
    setWorkspace(result);
  }, []);

  const value = useMemo(
    () => ({ workspace, isLoading, createWorkspace }),
    [workspace, isLoading, createWorkspace],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error(
      'useWorkspace deve ser usado dentro de um WorkspaceProvider',
    );
  }
  return context;
}
