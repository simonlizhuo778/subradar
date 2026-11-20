import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, getToken, setToken } from './api';

export interface UserProfile {
  id: number;
  email: string;
  displayName: string | null;
  createdAt: string;
}

interface AuthContextValue {
  token: string | null;
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // token 变化时拉取用户信息;401 则清掉本地失效 token
  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api<UserProfile>('/users/me')
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) {
          setToken(null);
          setTokenState(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ token: string }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setToken(res.token);
    setTokenState(res.token);
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const res = await api<{ token: string }>('/auth/register', {
        method: 'POST',
        body: { email, password, displayName },
      });
      setToken(res.token);
      setTokenState(res.token);
    },
    [],
  );

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth 必须在 <AuthProvider> 内使用');
  }
  return ctx;
}
