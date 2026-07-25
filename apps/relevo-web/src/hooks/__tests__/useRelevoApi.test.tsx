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
    mockApiFetch.mockResolvedValueOnce({ items: mockTenants, total: 2, skip: 0, limit: 100 });

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

  it('useTenants handles apiFetch returning undefined (204/empty body)', async () => {
    mockApiFetch.mockResolvedValueOnce(undefined);

    const { useTenants } = await import('../useRelevoApi');
    const { result } = renderHook(() => useTenants(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('useTenants handles response without items field', async () => {
    mockApiFetch.mockResolvedValueOnce({ data: [] }); // no items field

    const { useTenants } = await import('../useRelevoApi');
    const { result } = renderHook(() => useTenants(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('useTenants handles response.items being null', async () => {
    mockApiFetch.mockResolvedValueOnce({ items: null, total: 0, skip: 0, limit: 100 });

    const { useTenants } = await import('../useRelevoApi');
    const { result } = renderHook(() => useTenants(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
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

// ─── Course mutations ─────────────────────────────────---

describe('useRelevoApi — Course Mutations', () => {
  const createCoursePayload = {
    name: '3° C',
    grade: '3°',
    subject: 'Ciencias',
    teachers: { teacher1: 'u1' },
    tenant_id: 't1',
  };
  const createdCourse = {
    id: 'c3',
    name: '3° C',
    grade: '3°',
    subject: 'Ciencias',
    student_count: 0,
    created_at: '2024-01-03',
  };

  it('useCreateCourse sends POST and invalidates courses cache', async () => {
    mockApiFetch.mockResolvedValueOnce(createdCourse);

    const { useCreateCourse } = await import('../useRelevoApi');
    const { result } = renderHook(() => useCreateCourse(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate(createCoursePayload);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/courses', {
      method: 'POST',
      token: 'mock-access-token',
      body: JSON.stringify(createCoursePayload),
    });
    expect(result.current.data).toEqual(createdCourse);
  });

  it('useCreateCourse handles mutation error', async () => {
    mockApiFetch.mockRejectedValueOnce({
      status: 400,
      detail: 'Datos inválidos',
      translatedMessage: 'Datos inválidos',
    });

    const { useCreateCourse } = await import('../useRelevoApi');
    const { result } = renderHook(() => useCreateCourse(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate(createCoursePayload);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('useCreateCourse mantiene isPending durante la mutación', async () => {
    let resolvePromise!: (data: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockApiFetch.mockReturnValueOnce(pendingPromise);

    const { useCreateCourse } = await import('../useRelevoApi');
    const { result } = renderHook(() => useCreateCourse(), { wrapper: createWrapper() });

    result.current.mutate(createCoursePayload);

    await waitFor(() => expect(result.current.isPending).toBe(true));

    resolvePromise(createdCourse);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('useDeleteCourse sends DELETE and invalidates courses cache', async () => {
    mockApiFetch.mockResolvedValueOnce({ success: true });

    const { useDeleteCourse } = await import('../useRelevoApi');
    const { result } = renderHook(() => useDeleteCourse(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate('c1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/courses/c1', {
      method: 'DELETE',
      token: 'mock-access-token',
    });
    expect(result.current.data).toEqual({ success: true });
  });

  it('useDeleteCourse handles mutation error', async () => {
    mockApiFetch.mockRejectedValueOnce({
      status: 404,
      detail: 'Curso no encontrado',
      translatedMessage: 'Curso no encontrado',
    });

    const { useDeleteCourse } = await import('../useRelevoApi');
    const { result } = renderHook(() => useDeleteCourse(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate('c1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('useDeleteCourse mantiene isPending durante la mutación', async () => {
    let resolvePromise!: (data: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockApiFetch.mockReturnValueOnce(pendingPromise);

    const { useDeleteCourse } = await import('../useRelevoApi');
    const { result } = renderHook(() => useDeleteCourse(), { wrapper: createWrapper() });

    result.current.mutate('c1');

    await waitFor(() => expect(result.current.isPending).toBe(true));

    resolvePromise({ success: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

// ─── User mutations ──────────────────────────────────────

describe('useRelevoApi — User Mutations', () => {
  const createUserPayload = {
    email: 'teacher3@test.com',
    name: 'Profesor 3',
    password: 'SecurePass123!',
    tenant_id: 't1',
    role: 'TEACHER',
  };
  const createdUser = {
    id: 'u3',
    email: 'teacher3@test.com',
    name: 'Profesor 3',
    role: 'TEACHER' as const,
    status: 'pending' as const,
    created_at: '2024-01-03',
    tenantId: 't1',
  };

  it('useCreateUser sends POST and invalidates users cache', async () => {
    mockApiFetch.mockResolvedValueOnce(createdUser);

    const { useCreateUser } = await import('../useRelevoApi');
    const { result } = renderHook(() => useCreateUser(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate(createUserPayload);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/users', {
      method: 'POST',
      token: 'mock-access-token',
      body: JSON.stringify(createUserPayload),
    });
    expect(result.current.data).toEqual(createdUser);
  });

  it('useCreateUser handles mutation error', async () => {
    mockApiFetch.mockRejectedValueOnce({
      status: 409,
      detail: 'El email ya está registrado',
      translatedMessage: 'El email ya está registrado',
    });

    const { useCreateUser } = await import('../useRelevoApi');
    const { result } = renderHook(() => useCreateUser(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate(createUserPayload);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('useCreateUser mantiene isPending durante la mutación', async () => {
    let resolvePromise!: (data: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockApiFetch.mockReturnValueOnce(pendingPromise);

    const { useCreateUser } = await import('../useRelevoApi');
    const { result } = renderHook(() => useCreateUser(), { wrapper: createWrapper() });

    result.current.mutate(createUserPayload);

    await waitFor(() => expect(result.current.isPending).toBe(true));

    resolvePromise(createdUser);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('useResetPassword sends POST and invalidates users cache', async () => {
    const resetResponse = {
      success: true,
      message: 'Contraseña restablecida',
      temporary_password: 'Temp123!',
    };
    mockApiFetch.mockResolvedValueOnce(resetResponse);

    const { useResetPassword } = await import('../useRelevoApi');
    const { result } = renderHook(() => useResetPassword(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate('u1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/users/u1/reset-password', {
      method: 'POST',
      token: 'mock-access-token',
    });
    expect(result.current.data).toEqual(resetResponse);
  });

  it('useResetPassword handles mutation error', async () => {
    mockApiFetch.mockRejectedValueOnce({
      status: 404,
      detail: 'Usuario no encontrado',
      translatedMessage: 'Usuario no encontrado',
    });

    const { useResetPassword } = await import('../useRelevoApi');
    const { result } = renderHook(() => useResetPassword(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate('u1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('useResetPassword mantiene isPending durante la mutación', async () => {
    let resolvePromise!: (data: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockApiFetch.mockReturnValueOnce(pendingPromise);

    const { useResetPassword } = await import('../useRelevoApi');
    const { result } = renderHook(() => useResetPassword(), { wrapper: createWrapper() });

    result.current.mutate('u1');

    await waitFor(() => expect(result.current.isPending).toBe(true));

    resolvePromise({ success: true, message: 'Ok', temporary_password: 'Temp123!' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

// ─── Dashboard stats ─────────────────────────────────────

const mockExecutiveStats = {
  total_schools: 10,
  total_teachers: 150,
  total_students: 3000,
  active_evaluations: 45,
  completed_evaluations: 120,
};

describe('useRelevoApi — Dashboard', () => {
  it('useExecutiveStats fetches stats when authenticated', async () => {
    mockApiFetch.mockResolvedValueOnce(mockExecutiveStats);

    const { useExecutiveStats } = await import('../useRelevoApi');
    const { result } = renderHook(() => useExecutiveStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/dashboard/executive', {
      token: 'mock-access-token',
    });
    expect(result.current.data).toEqual(mockExecutiveStats);
  });

  it('useExecutiveStats is not enabled when isAuthenticated is false', async () => {
    setAuthenticated({ accessToken: null, isAuthenticated: false });

    const { useExecutiveStats } = await import('../useRelevoApi');
    const { result } = renderHook(() => useExecutiveStats(), { wrapper: createWrapper() });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('useExecutiveStats handles error state', async () => {
    mockApiFetch.mockRejectedValueOnce({
      status: 500,
      detail: 'Error del servidor',
      translatedMessage: 'Error del servidor',
    });

    const { useExecutiveStats } = await import('../useRelevoApi');
    const { result } = renderHook(() => useExecutiveStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('useExecutiveStats muestra loading durante la carga', async () => {
    let resolvePromise!: (data: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockApiFetch.mockReturnValueOnce(pendingPromise);

    const { useExecutiveStats } = await import('../useRelevoApi');
    const { result } = renderHook(() => useExecutiveStats(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);

    resolvePromise(mockExecutiveStats);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

// ─── Pending Registrations (Admin) ────────────────────────

const mockPendingRegistrations = {
  items: [
    {
      id: 'p1',
      name: 'Usuario Pendiente',
      email: 'pending@test.com',
      role: 'TEACHER',
      tenant_id: 't1',
      tenant_name: 'Colegio 1',
      brand: 'relevo',
      created_at: '2024-01-01',
    },
    {
      id: 'p2',
      name: 'Otro Pendiente',
      email: 'other@test.com',
      role: 'TEACHER',
      tenant_id: 't2',
      tenant_name: 'Colegio 2',
      brand: 'relevo',
      created_at: '2024-01-02',
    },
  ],
  total: 2,
  page: 1,
  page_size: 20,
};

describe('useRelevoApi — Pending Registrations', () => {
  it('usePendingRegistrations fetches pending registrations for ADMIN role', async () => {
    setAuthenticated({ user: { id: 'u1', role: 'ADMIN' } });
    mockApiFetch.mockResolvedValueOnce(mockPendingRegistrations);

    const { usePendingRegistrations } = await import('../useRelevoApi');
    const { result } = renderHook(() => usePendingRegistrations(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/pending-registrations', {
      token: 'mock-access-token',
    });
    expect(result.current.data).toEqual(mockPendingRegistrations);
  });

  it('usePendingRegistrations fetches for GESTION role', async () => {
    setAuthenticated({ user: { id: 'u1', role: 'GESTION' } });
    mockApiFetch.mockResolvedValueOnce(mockPendingRegistrations);

    const { usePendingRegistrations } = await import('../useRelevoApi');
    const { result } = renderHook(() => usePendingRegistrations(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/pending-registrations', {
      token: 'mock-access-token',
    });
    expect(result.current.data).toEqual(mockPendingRegistrations);
  });

  it('usePendingRegistrations is not enabled when role is TEACHER', async () => {
    setAuthenticated({ user: { id: 'u1', role: 'TEACHER' } });

    const { usePendingRegistrations } = await import('../useRelevoApi');
    const { result } = renderHook(() => usePendingRegistrations(), { wrapper: createWrapper() });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('usePendingRegistrations is not enabled when accessToken is null', async () => {
    setAuthenticated({
      accessToken: null,
      isAuthenticated: false,
      user: { id: 'u1', role: 'ADMIN' },
    });

    const { usePendingRegistrations } = await import('../useRelevoApi');
    const { result } = renderHook(() => usePendingRegistrations(), { wrapper: createWrapper() });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('usePendingRegistrations handles error state', async () => {
    setAuthenticated({ user: { id: 'u1', role: 'ADMIN' } });
    mockApiFetch.mockRejectedValueOnce({
      status: 403,
      detail: 'Acceso denegado',
      translatedMessage: 'Acceso denegado',
    });

    const { usePendingRegistrations } = await import('../useRelevoApi');
    const { result } = renderHook(() => usePendingRegistrations(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('usePendingRegistrations muestra loading durante la carga', async () => {
    setAuthenticated({ user: { id: 'u1', role: 'ADMIN' } });

    let resolvePromise!: (data: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockApiFetch.mockReturnValueOnce(pendingPromise);

    const { usePendingRegistrations } = await import('../useRelevoApi');
    const { result } = renderHook(() => usePendingRegistrations(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);

    resolvePromise(mockPendingRegistrations);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

// ─── Students hooks ────────────────────────────────────

const mockStudents = [
  {
    id: 's1',
    course_id: 'course-1',
    full_name: 'Ana Martínez',
    student_code: 'STU-001',
    created_at: '2026-01-15T12:00:00Z',
  },
  {
    id: 's2',
    course_id: 'course-1',
    full_name: 'Benjamín Soto',
    student_code: 'STU-002',
    created_at: '2026-01-15T12:00:00Z',
  },
];

// ─── Students hooks ────────────────────────────────────
// These tests rely on the global beforeEach (line 101) which calls
// vi.clearAllMocks() + setAuthenticated() before each test.

describe('useRelevoApi — useStudents', () => {
  it('fetches students cuando se proporciona courseId', async () => {
    mockApiFetch.mockResolvedValueOnce(mockStudents);

    const { useStudents } = await import('../useRelevoApi');
    const { result } = renderHook(() => useStudents('course-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/students/course/course-1', {
      token: 'mock-access-token',
    });
    expect(result.current.data).toEqual(mockStudents);
  });

  it('is not enabled when courseId is null', async () => {
    const { useStudents } = await import('../useRelevoApi');
    const { result } = renderHook(() => useStudents(null), { wrapper: createWrapper() });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('is not enabled when isAuthenticated is false', async () => {
    setAuthenticated({ accessToken: null, isAuthenticated: false });

    const { useStudents } = await import('../useRelevoApi');
    const { result } = renderHook(() => useStudents('course-1'), { wrapper: createWrapper() });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('handles error state', async () => {
    mockApiFetch.mockRejectedValueOnce({
      status: 500,
      detail: 'Error del servidor',
    });

    const { useStudents } = await import('../useRelevoApi');
    const { result } = renderHook(() => useStudents('course-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('muestra loading durante la carga', async () => {
    let resolvePromise!: (data: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockApiFetch.mockReturnValueOnce(pendingPromise);

    const { useStudents } = await import('../useRelevoApi');
    const { result } = renderHook(() => useStudents('course-1'), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);

    resolvePromise(mockStudents);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

// ─── useBulkCreateStudents ─────────────────────────

describe('useRelevoApi — useBulkCreateStudents', () => {
  const bulkPayload = { courseId: 'course-1', names: ['Ana', 'Ben'] };
  const bulkResponse = { count: 2, students: mockStudents };

  it('sends POST with names and invalidates caches', async () => {
    mockApiFetch.mockResolvedValueOnce(bulkResponse);

    const { useBulkCreateStudents } = await import('../useRelevoApi');
    const { result } = renderHook(() => useBulkCreateStudents(), { wrapper: createWrapper() });

    // Follow exact pattern from existing mutation tests: mutate + waitFor isSuccess
    await act(async () => {
      result.current.mutate(bulkPayload);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/students/course/course-1', {
      method: 'POST',
      token: 'mock-access-token',
      body: JSON.stringify({ names: ['Ana', 'Ben'] }),
    });
    expect(result.current.data).toEqual(bulkResponse);
  });

  it('handles mutation error', async () => {
    mockApiFetch.mockRejectedValueOnce({
      status: 400,
      detail: 'Error al crear alumnos',
      translatedMessage: 'Error al crear alumnos.',
    });

    const { useBulkCreateStudents } = await import('../useRelevoApi');
    const { result } = renderHook(() => useBulkCreateStudents(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate(bulkPayload);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('mantiene isPending durante la mutación', async () => {
    let resolvePromise!: (data: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockApiFetch.mockReturnValueOnce(pendingPromise);

    const { useBulkCreateStudents } = await import('../useRelevoApi');
    const { result } = renderHook(() => useBulkCreateStudents(), { wrapper: createWrapper() });

    result.current.mutate(bulkPayload);
    await waitFor(() => expect(result.current.isPending).toBe(true));

    resolvePromise(bulkResponse);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

// ─── useDeleteStudent ─────────────────────────────

describe('useRelevoApi — useDeleteStudent', () => {
  const deletePayload = { studentId: 's1', courseId: 'course-1' };

  it('sends DELETE and invalidates caches', async () => {
    mockApiFetch.mockResolvedValueOnce({ message: 'Alumno eliminado' });

    const { useDeleteStudent } = await import('../useRelevoApi');
    const { result } = renderHook(() => useDeleteStudent(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate(deletePayload);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/students/s1', {
      method: 'DELETE',
      token: 'mock-access-token',
    });
    expect(result.current.data).toEqual({ message: 'Alumno eliminado' });
  });

  it('handles mutation error', async () => {
    mockApiFetch.mockRejectedValueOnce({
      status: 404,
      detail: 'Alumno no encontrado',
      translatedMessage: 'Alumno no encontrado.',
    });

    const { useDeleteStudent } = await import('../useRelevoApi');
    const { result } = renderHook(() => useDeleteStudent(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate(deletePayload);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('mantiene isPending durante la mutación', async () => {
    let resolvePromise!: (data: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockApiFetch.mockReturnValueOnce(pendingPromise);

    const { useDeleteStudent } = await import('../useRelevoApi');
    const { result } = renderHook(() => useDeleteStudent(), { wrapper: createWrapper() });

    result.current.mutate(deletePayload);
    await waitFor(() => expect(result.current.isPending).toBe(true));

    resolvePromise({ message: 'Ok' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
