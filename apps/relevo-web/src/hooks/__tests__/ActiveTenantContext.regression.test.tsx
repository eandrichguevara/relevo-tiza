import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ─── Regression: bug "tenantList.find is not a function" ──────────
//
// El backend retorna { items, total, skip, limit }, NO un array.
// Raven reportó "tenantList.find is not a function" porque el frontend
// trataba el objeto paginado como si fuera un array.
//
// Fix en useTenants: extrae response.items ANTES de devolverlo.
// Fix en ActiveTenantContext: Array.isArray(tenants) ? tenants : []
//
// Este test verifica la CAPA DE DEFENSA en ActiveTenantContext:
// si useTenants retorna un objeto no-array (viejo comportamiento),
// el contexto no crashea y expone tenants como [].
//
// Se usa un archivo separado porque necesita mockear useRelevoApi
// completamente (vi.mock) sin interferir con otros tests.

// ─── Mock: useRelevoApi retorna objeto no-array ──────────────
//
// Simula el escenario del bug original donde useTenants devolvía
// el objeto paginado completo { items, total, skip, limit } en
// lugar del array extraído.

const mockNonArrayData = {
  items: [
    { id: 't1', name: 'Colegio 1', subdomain: 'c1', brand: 'relevo', settings: {} },
    { id: 't2', name: 'Colegio 2', subdomain: 'c2', brand: 'relevo', settings: {} },
  ],
  total: 2,
  skip: 0,
  limit: 100,
};

vi.mock('../useRelevoApi', () => ({
  useTenants: () => ({
    data: mockNonArrayData as any, // objeto NO array — el bug original
    isLoading: false,
    isError: false,
  }),
}));

// ─── Tests ──────────────────────────────────────────────────

describe('ActiveTenantProvider — regression: non-array tenants', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('no crashea cuando useTenants devuelve un objeto no-array', async () => {
    const { ActiveTenantProvider, useActiveTenant } = await import('../ActiveTenantContext');

    const { result } = renderHook(() => useActiveTenant(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <ActiveTenantProvider>{children}</ActiveTenantProvider>
        </QueryClientProvider>
      ),
    });

    // La defensa Array.isArray debe convertir el objeto a []
    // para prevenir "tenantList.find is not a function"
    expect(Array.isArray(result.current.tenants)).toBe(true);
    expect(result.current.tenants).toHaveLength(0);
    expect(result.current.activeTenant).toBeNull();
    expect(result.current.activeTenantId).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('setActiveTenantId no crashea sin tenants', async () => {
    const { ActiveTenantProvider, useActiveTenant } = await import('../ActiveTenantContext');

    const { result } = renderHook(() => useActiveTenant(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <ActiveTenantProvider>{children}</ActiveTenantProvider>
        </QueryClientProvider>
      ),
    });

    // setActiveTenantId debe funcionar incluso con tenants = []
    act(() => {
      result.current.setActiveTenantId('t1');
    });

    await waitFor(() => expect(result.current.activeTenantId).toBe('t1'));
    expect(localStorage.getItem('relevo-active-tenant')).toBe('t1');
  });
});
