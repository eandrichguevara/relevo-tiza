import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';

// ─── Mocks ──────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock fetch for session/token calls
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock apiFetch used inside loginUser / registerUser
const mockApiFetch = vi.fn();
vi.mock('@/lib/api', () => ({
  apiFetch: (...args: any[]) => mockApiFetch(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────

async function getAuthModule() {
  return await import('../useAuth');
}

function createWrapper() {
  const { AuthProvider } = await_import('../useAuth');
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>;
  };
}

// Helper to avoid top-level await issues
let AuthProvider: any;
let useAuth: any;

async function setupModule() {
  const mod = await import('../useAuth');
  AuthProvider = mod.AuthProvider;
  useAuth = mod.useAuth;
}

// ─── Tests ──────────────────────────────────────────────────

describe('AuthProvider + useAuth', () => {
  let Wrapper: ({ children }: { children: ReactNode }) => JSX.Element;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    await setupModule();
    Wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
  });

  describe('initial state', () => {
    it('comienza con isLoading=true cuando no hay sesión previa', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ user: null, accessToken: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
    });

    it('finaliza con isLoading=false cuando se completa la carga', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ user: null, accessToken: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('session restore', () => {
    it('restaura sesión desde cookie + localStorage', async () => {
      const storedUser = {
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
        role: 'HOLDER',
        status: 'active',
        tenantId: 't1',
      };
      localStorage.setItem('relevo-auth-user', JSON.stringify(storedUser));

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'token-123' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.token).toBe('token-123');
      expect(result.current.accessToken).toBe('token-123');
      expect(result.current.user).toEqual(storedUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('restaura sesión sin localStorage (reconstruye desde /api/auth/me)', async () => {
      // Token exists but no localStorage user
      mockFetch
        // First: session returns token
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ accessToken: 'token-456' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        // Second: /api/auth/me returns user profile
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 'user-2',
              email: 'reconstructed@test.com',
              name: 'Reconstructed',
              role: 'HOLDER',
              status: 'active',
              tenant_id: 't1',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );

      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.token).toBe('token-456');
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.name).toBe('Reconstructed');
    });

    it('no autentica cuando /api/auth/me falla (token inválido)', async () => {
      mockFetch
        // Session returns token
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ accessToken: 'token-invalid' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        // /api/auth/me returns 401
        .mockResolvedValueOnce(new Response(null, { status: 401 }));

      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('no autentica cuando no hay token ni usuario', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ user: null, accessToken: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('login', () => {
    it('login actualiza user y token exitosamente', async () => {
      // Session call on mount (no session)
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ user: null, accessToken: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Mock loginUser success
      mockApiFetch
        // First: login returns token
        .mockResolvedValueOnce({
          access_token: 'login-token',
          token_type: 'bearer',
        })
        // Second: /api/auth/me returns user
        .mockResolvedValueOnce({
          id: 'login-user',
          email: 'login@test.com',
          name: 'Login User',
          role: 'HOLDER',
          status: 'active',
          tenant_id: 't1',
        });

      // setTokenCookie fetch
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await act(async () => {
        await result.current.login('login@test.com', 'password');
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.token).toBe('login-token');
      expect(result.current.user?.name).toBe('Login User');
    });
  });

  describe('register', () => {
    it('register llama a apiFetch con datos del formulario', async () => {
      // Session call on mount (no session)
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ user: null, accessToken: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockApiFetch.mockResolvedValueOnce(undefined);

      const registerData = {
        name: 'New',
        email: 'new@test.com',
        password: 'password123',
        role: 'director',
      };

      await act(async () => {
        await result.current.register(registerData);
      });

      expect(mockApiFetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerData),
      });
    });
  });

  describe('logout', () => {
    it('logout limpia estado y redirige a /', async () => {
      // Session call on mount (no session)
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ user: null, accessToken: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      // Mock clearTokenCookie
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  describe('useAuth outside provider', () => {
    it('lanza error cuando se usa fuera de AuthProvider', () => {
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');
    });
  });
});
