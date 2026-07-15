import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

  // Tracks which usuario.id the workspace/isLoading state above was last
  // resolved for. WorkspaceProvider re-renders synchronously (same commit)
  // whenever AuthProvider's usuario changes, but the effect below only runs
  // *after* that paint — so on the transition render, `isLoading` can still
  // be a stale `false` left over from a previous (or absent) usuario. This
  // ref lets us detect "state hasn't caught up to the current usuario yet"
  // during render, instead of trusting isLoading alone.
  const resolvedUserIdRef = useRef<string | null>(null);

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
    resolvedUserIdRef.current = usuario?.id ?? null;

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

  // If there's a usuario but our state hasn't been resolved for THIS
  // usuario.id yet (the effect above hasn't run for it), report loading
  // regardless of what the raw isLoading state currently says — closes the
  // one-commit gap where a fresh usuario shows up alongside stale
  // workspace/isLoading values from a previous (or no) usuario.
  const isStaleForCurrentUser =
    !!usuario && resolvedUserIdRef.current !== usuario.id;
  const effectiveIsLoading = usuario
    ? isStaleForCurrentUser || isLoading
    : false;

  const value = useMemo(
    () => ({ workspace, isLoading: effectiveIsLoading, error, createWorkspace }),
    [workspace, effectiveIsLoading, error, createWorkspace],
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
