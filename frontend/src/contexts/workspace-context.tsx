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
  error: Error | null;
  createWorkspace: (tipo: PlanoTipo) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { usuario } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWorkspace = useCallback(async (): Promise<Workspace | null> => {
    try {
      return await apiGet<Workspace>('/workspaces/me');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }, []);

  useEffect(() => {
    let active = true;

    if (!usuario) {
      setWorkspace(null);
      setError(null);
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    setIsLoading(true);
    setError(null);
    (async () => {
      try {
        const result = await fetchWorkspace();
        if (active) {
          setWorkspace(result);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [usuario, fetchWorkspace]);

  const createWorkspace = useCallback(async (tipo: PlanoTipo) => {
    const result = await apiPost<Workspace>('/workspaces', { tipo });
    setWorkspace(result);
  }, []);

  const value = useMemo(
    () => ({ workspace, isLoading, error, createWorkspace }),
    [workspace, isLoading, error, createWorkspace],
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
