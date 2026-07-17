import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ─── Mocks ──────────────────────────────────────────────────

const mockAccessToken = 'mock-token-reset-pwd';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    accessToken: mockAccessToken,
  }),
}));

// We test via the actual apiFetch module, so we mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// ─── Helpers ──────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function mockSuccessfulReset() {
  mockFetch.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        success: true,
        message: 'Contraseña restaurada exitosamente.',
        temporary_password: 'NewTempPass123!',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  );
}

function mockErrorReset(status: number, detail: string) {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ detail }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

// ─── Tests ──────────────────────────────────────────────────

describe('useResetPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('llama al endpoint correcto con POST (sin body explícito)', async () => {
    mockSuccessfulReset();
    const { useResetPassword } = await import('../useRelevoApi');

    const { result } = renderHook(() => useResetPassword(), {
      wrapper: createWrapper(),
    });

    const userId = 'user-123';
    result.current.mutate(userId);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain(`/api/users/${userId}/reset-password`);
    expect(options.method).toBe('POST');
    // apiFetch no envía body cuando no se proporciona uno
    expect(options.body).toBeUndefined();
  });

  it('incluye el token de autorización en la petición', async () => {
    mockSuccessfulReset();
    const { useResetPassword } = await import('../useRelevoApi');

    const { result } = renderHook(() => useResetPassword(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('user-456');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockAccessToken}`,
        }),
      })
    );
  });

  it('retorna la contraseña temporal en data', async () => {
    mockSuccessfulReset();
    const { useResetPassword } = await import('../useRelevoApi');

    const { result } = renderHook(() => useResetPassword(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('user-789');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      success: true,
      message: 'Contraseña restaurada exitosamente.',
      temporary_password: 'NewTempPass123!',
    });
  });

  it('maneja error 404 cuando el usuario no existe', async () => {
    mockErrorReset(404, 'User not found');
    const { useResetPassword } = await import('../useRelevoApi');

    const { result } = renderHook(() => useResetPassword(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('non-existent-id');
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });

  it('maneja error 403 cuando no tiene permisos', async () => {
    mockErrorReset(403, 'Access denied');
    const { useResetPassword } = await import('../useRelevoApi');

    const { result } = renderHook(() => useResetPassword(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('user-no-permission');
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });

  it('invalida la query de usuarios al completarse exitosamente', async () => {
    mockSuccessfulReset();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Pre-set data in users cache
    queryClient.setQueryData(['users'], [{ id: '1', name: 'Test' }]);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    const { useResetPassword } = await import('../useRelevoApi');
    const { result } = renderHook(() => useResetPassword(), {
      wrapper: Wrapper,
    });

    result.current.mutate('user-invalidate');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users'] });
  });
});
