import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ─── Mocks ──────────────────────────────────────────────────

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    accessToken: 'mock-token',
    isAuthenticated: true,
    user: { id: '1', role: 'GESTION' },
  }),
}));

const mockTenants = [
  { id: 't1', name: 'Colegio San Miguel', subdomain: 'san-miguel', brand: 'relevo', settings: {} },
  {
    id: 't2',
    name: 'Liceo Gabriela Mistral',
    subdomain: 'gabriela-mistral',
    brand: 'relevo',
    settings: {},
  },
  {
    id: 't3',
    name: 'Instituto Nacional',
    subdomain: 'instituto-nacional',
    brand: 'relevo',
    settings: {},
  },
];

// ─── Tests ──────────────────────────────────────────────────

describe('ActiveTenantProvider + useActiveTenant', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('lanza error cuando useActiveTenant se usa fuera del provider', async () => {
    const { useActiveTenant } = await import('../ActiveTenantContext');
    expect(() => {
      renderHook(() => useActiveTenant());
    }).toThrow('useActiveTenant debe usarse dentro de <ActiveTenantProvider>');
  });

  it('carga tenants desde la API y selecciona el primero por defecto', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ items: mockTenants, total: 3, skip: 0, limit: 100 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { ActiveTenantProvider, useActiveTenant } = await import('../ActiveTenantContext');

    const { result } = renderHook(() => useActiveTenant(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <ActiveTenantProvider>{children}</ActiveTenantProvider>
        </QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tenants).toHaveLength(3);
    expect(result.current.activeTenantId).toBe('t1');
    expect(result.current.activeTenant?.name).toBe('Colegio San Miguel');
  });

  it('restaura tenant desde localStorage si es válido', async () => {
    localStorage.setItem('relevo-active-tenant', 't2');
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ items: mockTenants, total: 3, skip: 0, limit: 100 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { ActiveTenantProvider, useActiveTenant } = await import('../ActiveTenantContext');

    const { result } = renderHook(() => useActiveTenant(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <ActiveTenantProvider>{children}</ActiveTenantProvider>
        </QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.activeTenantId).toBe('t2');
    expect(result.current.activeTenant?.name).toBe('Liceo Gabriela Mistral');
  });

  it('ignora tenant inválido de localStorage y usa el primero', async () => {
    localStorage.setItem('relevo-active-tenant', 'non-existent-id');
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ items: mockTenants, total: 3, skip: 0, limit: 100 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { ActiveTenantProvider, useActiveTenant } = await import('../ActiveTenantContext');

    const { result } = renderHook(() => useActiveTenant(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <ActiveTenantProvider>{children}</ActiveTenantProvider>
        </QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.activeTenantId).toBe('t1');
  });

  it('setActiveTenantId cambia el tenant activo y persiste en localStorage', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ items: mockTenants, total: 3, skip: 0, limit: 100 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { ActiveTenantProvider, useActiveTenant } = await import('../ActiveTenantContext');

    const { result } = renderHook(() => useActiveTenant(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <ActiveTenantProvider>{children}</ActiveTenantProvider>
        </QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setActiveTenantId('t3');
    });

    expect(result.current.activeTenantId).toBe('t3');
    expect(result.current.activeTenant?.name).toBe('Instituto Nacional');
    expect(localStorage.getItem('relevo-active-tenant')).toBe('t3');
  });

  it('activeTenant es null cuando no hay tenants', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ items: [], total: 0, skip: 0, limit: 100 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { ActiveTenantProvider, useActiveTenant } = await import('../ActiveTenantContext');

    const { result } = renderHook(() => useActiveTenant(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <ActiveTenantProvider>{children}</ActiveTenantProvider>
        </QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tenants).toHaveLength(0);
    expect(result.current.activeTenant).toBeNull();
    expect(result.current.activeTenantId).toBeNull();
  });

  // ─── Regression: bug "tenantList.find is not a function" ──────────
  //
  // Como vi.doMock tiene problemas de caché de módulos en vitest con
  // imports dinámicos, el test de regresión específico para la defensa
  // Array.isArray contra objetos no-array vive en el archivo:
  //   src/hooks/__tests__/ActiveTenantContext.regression.test.tsx
  // Ese archivo mockea todo useRelevoApi de raíz y verifica que
  // ActiveTenantProvider no crashea con datos no-array.
});
