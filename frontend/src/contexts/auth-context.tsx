import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { apiGet, apiPost, setAccessToken, setAuthHandlers } from '@/lib/api';
import {
  clearStoredRefreshToken,
  getStoredRefreshToken,
  setStoredRefreshToken,
} from '@/lib/secure-storage';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  cpf: string;
}

interface AuthResult {
  usuario: Usuario;
  accessToken: string;
  refreshToken: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AuthContextValue {
  usuario: Usuario | null;
  isLoading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  register: (
    nome: string,
    email: string,
    cpf: string,
    senha: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback(async (result: AuthResult) => {
    setAccessToken(result.accessToken);
    setUsuario(result.usuario);
    await setStoredRefreshToken(result.refreshToken);
  }, []);

  const clearSession = useCallback(async () => {
    setAccessToken(null);
    setUsuario(null);
    await clearStoredRefreshToken();
  }, []);

  const silentRefresh = useCallback(async (): Promise<string | null> => {
    const storedToken = await getStoredRefreshToken();
    if (!storedToken) {
      return null;
    }

    try {
      const tokens = await apiPost<TokenPair>('/auth/refresh', {
        refreshToken: storedToken,
      });
      setAccessToken(tokens.accessToken);
      await setStoredRefreshToken(tokens.refreshToken);
      return tokens.accessToken;
    } catch {
      await clearSession();
      return null;
    }
  }, [clearSession]);

  useEffect(() => {
    setAuthHandlers({
      refreshAccessToken: silentRefresh,
      onUnauthorized: () => {
        void clearSession();
      },
    });
  }, [silentRefresh, clearSession]);

  useEffect(() => {
    (async () => {
      const newAccessToken = await silentRefresh();
      if (newAccessToken) {
        try {
          const me = await apiGet<Usuario>('/auth/me');
          setUsuario(me);
        } catch {
          await clearSession();
        }
      }
      setIsLoading(false);
    })();
  }, [silentRefresh, clearSession]);

  const login = useCallback(
    async (email: string, senha: string) => {
      const result = await apiPost<AuthResult>('/auth/login', {
        email,
        senha,
      });
      await applySession(result);
    },
    [applySession],
  );

  const register = useCallback(
    async (nome: string, email: string, cpf: string, senha: string) => {
      const result = await apiPost<AuthResult>('/auth/register', {
        nome,
        email,
        cpf,
        senha,
      });
      await applySession(result);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    const storedToken = await getStoredRefreshToken();
    if (storedToken) {
      try {
        await apiPost('/auth/logout', { refreshToken: storedToken });
      } catch {
        // sessão já pode ter sido revogada no servidor; segue com a limpeza local
      }
    }
    await clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ usuario, isLoading, login, register, logout }),
    [usuario, isLoading, login, register, logout],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
