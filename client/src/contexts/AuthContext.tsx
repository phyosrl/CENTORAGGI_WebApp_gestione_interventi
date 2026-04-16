import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { loginRisorsa, LoginResponse } from '../services/api';

interface AuthState {
  user: LoginResponse | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'centoraggi_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return {
      user: stored ? JSON.parse(stored) : null,
      isLoading: false,
      error: null,
    };
  });

  useEffect(() => {
    if (state.user) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.user));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [state.user]);

  const login = useCallback(async (password: string) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const user = await loginRisorsa(password);
      setState({ user, isLoading: false, error: null });
    } catch (err: any) {
      const message =
        err?.response?.data?.error || 'Errore durante il login';
      setState((s) => ({ ...s, isLoading: false, error: message }));
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    setState({ user: null, isLoading: false, error: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
