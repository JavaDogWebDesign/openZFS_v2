import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { createElement } from 'react';
import type { SessionInfo } from '@zfs-manager/shared';
import { authApi } from '@/api/endpoints';

interface AuthState {
  user: SessionInfo | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isAdmin: false,
    isLoading: true,
  });

  const checkAuth = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    const result = await authApi.me();
    if (result.success) {
      setState({
        user: result.data,
        isAuthenticated: true,
        isAdmin: result.data.isAdmin,
        isLoading: false,
      });
    } else {
      setState({
        user: null,
        isAuthenticated: false,
        isAdmin: false,
        isLoading: false,
      });
    }
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    const result = await authApi.login(username, password);
    if (result.success) {
      setState({
        user: result.data,
        isAuthenticated: true,
        isAdmin: result.data.isAdmin,
        isLoading: false,
      });
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setState({
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      isLoading: false,
    });
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    checkAuth,
  };

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
