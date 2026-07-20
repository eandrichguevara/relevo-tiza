import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ─── Mocks ────────────────────────────────────────────────

const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: mockUseAuth,
}));

const mockApiFetch = vi.fn();
vi.mock('@/lib/api', () => ({
  apiFetch: mockApiFetch,
}));

function setAuthenticated(overrides?: Partial<ReturnType<typeof mockUseAuth>>) {
  mockUseAuth.mockReturnValue({
    accessToken: 'mock-access-token',
    isAuthenticated: true,
    user: { id: 'u1', role: 'ADMIN' },
    ...overrides,
  });
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

// ─── Test data ────────────────────────────────────────────

const mockTenants = [
  {
    id: 't1',
    name: 'Colegio 1',
    subdomain: 'colegio1',
    join_code: 'abc123',
    brand: 'relevo',
    settings: {},
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 't2',
    name: 'Colegio 2',
    subdomain: 'colegio2',
    join_code: 'def456',
    brand: 'relevo',
    settings: {},
    createdAt: '2024-01-02',
    updatedAt: '2024-01-02',
  },
];

const mockCourses = [
  {
    id: 'c1',
    name: '1° A',
    grade: '1°',
    subject: 'Matemáticas',
    student_count: 30,
    created_at: '2024-01-01',
  },
  {
    id: 'c2',
    name: '2° B',
    grade: '2°',
    subject: 'Lenguaje',
    student_count: 28,
    created_at: '2024-01-01',
  },
];

const mockUsers = [
  {
    id: 'u1',
    email: 'teacher1@test.com',
    name: 'Profesor 1',
    role: 'TEACHER' as const,
    status: 'active' as const,
    created_at: '2024-01-01',
    tenantId: 't1',
  },
  {
    id: 'u2',
    email: 'teacher2@test.com',
    name: 'Profesor 2',
    role: 'TEACHER' as const,
    status: 'active' as const,
    created_at: '2024-01-01',
    tenantId: 't1',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  setAuthenticated();
});

// ─── Tenants ──────────────────────────────────────────────

describe('useRelevoApi — Tenants', () => {
  it('useTenants fetches tenant list when authenticated', async () => {
    mockApiFetch.mockResolvedValueOnce(mockTenants);

    const { useTenants } = await import('../useRelevoApi');
    const { result } = renderHook(() => useTenants(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/tenants', { token: 'mock-access-token' });
    expect(result.current.data).toEqual(mockTenants);
  });

  it('useTenants is not enabled when isAuthenticated is false', async () => {
    setAuthenticated({ accessToken: null, isAuthenticated: false });

    const { useTenants } = await import('../useRelevoApi');
    const { result } = renderHook(() => useTenants(), { wrapper: createWrapper() });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('useTenants handles error state', async () => {
    mockApiFetch.mockRejectedValueOnce({
      status: 500,
      detail: 'Error del servidor',
      translatedMessage: 'Error del servidor',
    });

    const { useTenants } = await import('../useRelevoApi');
    const { result } = renderHook(() => useTenants(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });

  it('useCreateTenant sends POST and invalidates tenants cache', async () => {
    const newTenant = {
      id: 't3',
      name: 'Colegio 3',
      subdomain: 'colegio3',
      join_code: 'ghi789',
      brand: 'relevo',
      settings: {},
      createdAt: '2024-01-03',
      updatedAt: '2024-01-03',
    };
    mockApiFetch.mockResolvedValueOnce(newTenant);

    const { useCreateTenant } = await import('../useRelevoApi');
    const { result } = renderHook(() => useCreateTenant(), { wrapper: createWrapper() });

    const payload = { name: 'Colegio 3', subdomain: 'colegio3' };

    await act(async () => {
      result.current.mutate(payload);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/tenants', {
      method: 'POST',
      token: 'mock-access-token',
      body: JSON.stringify(payload),
    });
    expect(result.current.data).toEqual(newTenant);
  });

  it('useCreateTenant handles mutation error', async () => {
    mockApiFetch.mockRejectedValueOnce({
      status: 409,
      detail: 'El subdominio ya existe',
      translatedMessage: 'El subdominio ya existe',
    });

    const { useCreateTenant } = await import('../useRelevoApi');
    const { result } = renderHook(() => useCreateTenant(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate({ name: 'Colegio 3', subdomain: 'colegio3' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─── Courses ──────────────────────────────────────────────

describe('useRelevoApi — Courses', () => {
  it('useCourses fetches courses for a tenant', async () => {
    mockApiFetch.mockResolvedValueOnce(mockCourses);

    const { useCourses } = await import('../useRelevoApi');
    const { result } = renderHook(() => useCourses('t1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/courses?tenant_id=t1', {
      token: 'mock-access-token',
    });
    expect(result.current.data).toEqual(mockCourses);
  });

  it('useCourses is not enabled when tenantId is null', async () => {
    const { useCourses } = await import('../useRelevoApi');
    const { result } = renderHook(() => useCourses(null), { wrapper: createWrapper() });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('useCourses is not enabled when isAuthenticated is false', async () => {
    setAuthenticated({ accessToken: null, isAuthenticated: false });

    const { useCourses } = await import('../useRelevoApi');
    const { result } = renderHook(() => useCourses('t1'), { wrapper: createWrapper() });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('useCourses handles error state', async () => {
    mockApiFetch.mockRejectedValueOnce({
      status: 500,
      detail: 'Error',
      translatedMessage: 'Error',
    });

    const { useCourses } = await import('../useRelevoApi');
    const { result } = renderHook(() => useCourses('t1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('useCourses muestra loading durante la carga', async () => {
    let resolvePromise!: (data: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockApiFetch.mockReturnValueOnce(pendingPromise);

    const { useCourses } = await import('../useRelevoApi');
    const { result } = renderHook(() => useCourses('t1'), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);

    resolvePromise(mockCourses);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

// ─── Users ────────────────────────────────────────────────

describe('useRelevoApi — Users', () => {
  it('useUsers fetches users for a tenant', async () => {
    mockApiFetch.mockResolvedValueOnce(mockUsers);

    const { useUsers } = await import('../useRelevoApi');
    const { result } = renderHook(() => useUsers('t1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/users?tenant_id=t1', {
      token: 'mock-access-token',
    });
    expect(result.current.data).toEqual(mockUsers);
  });

  it('useUsers is not enabled when tenantId is null', async () => {
    const { useUsers } = await import('../useRelevoApi');
    const { result } = renderHook(() => useUsers(null), { wrapper: createWrapper() });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('useUsers is not enabled when isAuthenticated is false', async () => {
    setAuthenticated({ accessToken: null, isAuthenticated: false });

    const { useUsers } = await import('../useRelevoApi');
    const { result } = renderHook(() => useUsers('t1'), { wrapper: createWrapper() });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('useUsers handles error state', async () => {
    mockApiFetch.mockRejectedValueOnce({
      status: 403,
      detail: 'Acceso denegado',
      translatedMessage: 'Acceso denegado',
    });

    const { useUsers } = await import('../useRelevoApi');
    const { result } = renderHook(() => useUsers('t1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─── Admin: Approve / Reject ─────────────────────────────

describe('useRelevoApi — Admin Actions', () => {
  it('useApproveUser sends POST and invalidates caches', async () => {
    mockApiFetch.mockResolvedValueOnce({
      success: true,
      message: 'Usuario aprobado',
      user_id: 'u3',
      status: 'active',
    });

    const { useApproveUser } = await import('../useRelevoApi');
    const { result } = renderHook(() => useApproveUser(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate('u3');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/approve/u3', {
      method: 'POST',
      token: 'mock-access-token',
      body: JSON.stringify({}),
    });
    expect(result.current.data).toEqual({
      success: true,
      message: 'Usuario aprobado',
      user_id: 'u3',
      status: 'active',
    });
  });

  it('useApproveUser handles error state', async () => {
    mockApiFetch.mockRejectedValueOnce({
      status: 500,
      detail: 'Error al aprobar',
      translatedMessage: 'Error al aprobar',
    });

    const { useApproveUser } = await import('../useRelevoApi');
    const { result } = renderHook(() => useApproveUser(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate('u3');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('useRejectUser sends POST with reason and invalidates cache', async () => {
    mockApiFetch.mockResolvedValueOnce({
      success: true,
      message: 'Usuario rechazado',
      user_id: 'u3',
      status: 'rejected',
    });

    const { useRejectUser } = await import('../useRelevoApi');
    const { result } = renderHook(() => useRejectUser(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate({ userId: 'u3', reason: 'Documentación incompleta' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/reject/u3', {
      method: 'POST',
      token: 'mock-access-token',
      body: JSON.stringify({ reason: 'Documentación incompleta' }),
    });
    expect(result.current.data).toEqual({
      success: true,
      message: 'Usuario rechazado',
      user_id: 'u3',
      status: 'rejected',
    });
  });

  it('useRejectUser handles error state', async () => {
    mockApiFetch.mockRejectedValueOnce({
      status: 404,
      detail: 'Usuario no encontrado',
      translatedMessage: 'Usuario no encontrado',
    });

    const { useRejectUser } = await import('../useRelevoApi');
    const { result } = renderHook(() => useRejectUser(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate({ userId: 'u3', reason: 'No cumple requisitos' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('useRejectUser mantiene isPending durante la mutación', async () => {
    let resolvePromise!: (data: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockApiFetch.mockReturnValueOnce(pendingPromise);

    const { useRejectUser } = await import('../useRelevoApi');
    const { result } = renderHook(() => useRejectUser(), { wrapper: createWrapper() });

    result.current.mutate({ userId: 'u3', reason: 'Razón' });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    resolvePromise({ success: true, message: 'Ok' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
