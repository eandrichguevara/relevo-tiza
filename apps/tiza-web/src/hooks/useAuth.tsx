'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  loginUser,
  registerUser,
  clearAuth,
  fetchTokenFromSession,
  getStoredUser,
  storeUser,
  type AuthUser,
} from '@/lib/auth';

// ─── Context type ────────────────────────────────────────

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  accessToken: string | null; // alias for backward compat with useApi
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    role: string;
    school?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────

const BRAND = (process.env.NEXT_PUBLIC_BRAND as 'tiza' | 'relevo') || 'tiza';

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount from HttpOnly cookie (via /api/auth/session) + localStorage
  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          fetchTokenFromSession(),
          Promise.resolve(getStoredUser()),
        ]);

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(storedUser);
        }
      } catch {
        // Session restore failed — user will need to log in
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginUser(email, password, BRAND);
    setToken(result.token);
    setUser(result.user);
  }, []);

  const register = useCallback(
    async (data: {
      name: string;
      email: string;
      password: string;
      role: string;
      school?: string;
    }) => {
      await registerUser(data);
    },
    []
  );

  const logout = useCallback(async () => {
    await clearAuth();
    setToken(null);
    setUser(null);
    router.push('/');
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        accessToken: token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
