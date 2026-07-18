import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ─── Mocks ────────────────────────────────────────────────

const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: mockUseAuth,
}));

const mockApiFetch = vi.fn();
const mockApiUpload = vi.fn();
vi.mock('@/lib/api', () => ({
  apiFetch: mockApiFetch,
  apiUpload: mockApiUpload,
}));

function setAuthenticated(overrides?: Partial<ReturnType<typeof mockUseAuth>>) {
  mockUseAuth.mockReturnValue({
    accessToken: 'mock-access-token',
    isAuthenticated: true,
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

// ─── Helpers ──────────────────────────────────────────────

const mockUser = { id: 'u1', name: 'Test User' };

beforeEach(() => {
  vi.clearAllMocks();
  setAuthenticated();
});

// ─── Evaluations ──────────────────────────────────────────

describe('useApi — Evaluations', () => {
  it('useEvaluations fetches all evaluations', async () => {
    const data = [{ id: 'e1', name: 'Math Test' }];
    mockApiFetch.mockResolvedValueOnce(data);

    const { useEvaluations } = await import('../useApi');
    const { result } = renderHook(() => useEvaluations(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/evaluations', { token: 'mock-access-token' });
    expect(result.current.data).toEqual(data);
  });

  it('useEvaluation fetches single evaluation by id', async () => {
    const data = { id: 'e1', name: 'Math Test' };
    mockApiFetch.mockResolvedValueOnce(data);

    const { useEvaluation } = await import('../useApi');
    const { result } = renderHook(() => useEvaluation('e1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/evaluations/e1', {
      token: 'mock-access-token',
    });
    expect(result.current.data).toEqual(data);
  });

  it('useEvaluation is not enabled when id is empty', async () => {
    const { useEvaluation } = await import('../useApi');
    const { result } = renderHook(() => useEvaluation(''), { wrapper: createWrapper() });

    // Should never fetch because enabled=false
    await new Promise((r) => setTimeout(r, 50));
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('useCreateEvaluation sends POST and invalidates evaluations cache', async () => {
    mockApiFetch.mockResolvedValueOnce({ id: 'new-eval' });

    const { useCreateEvaluation } = await import('../useApi');
    const { result } = renderHook(() => useCreateEvaluation(), { wrapper: createWrapper() });

    const payload = { name: 'New Eval', grade: '1st', subject: 'Math' };

    await act(async () => {
      result.current.mutate(payload);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/evaluations', {
      method: 'POST',
      token: 'mock-access-token',
      body: JSON.stringify(payload),
    });
  });

  it('useDeleteEvaluation sends DELETE and invalidates', async () => {
    mockApiFetch.mockResolvedValueOnce(undefined);

    const { useDeleteEvaluation } = await import('../useApi');
    const { result } = renderHook(() => useDeleteEvaluation(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate('e1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/evaluations/e1', {
      method: 'DELETE',
      token: 'mock-access-token',
    });
  });
});

// ─── Results ──────────────────────────────────────────────

describe('useApi — Results', () => {
  it('useResults fetches results for an evaluation', async () => {
    const data = [{ id: 'r1', score: 85 }];
    mockApiFetch.mockResolvedValueOnce(data);

    const { useResults } = await import('../useApi');
    const { result } = renderHook(() => useResults('eval-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/results/evaluation/eval-1', {
      token: 'mock-access-token',
    });
    expect(result.current.data).toEqual(data);
  });

  it('useResult fetches single result by id', async () => {
    const data = { id: 'r1', score: 95 };
    mockApiFetch.mockResolvedValueOnce(data);

    const { useResult } = await import('../useApi');
    const { result } = renderHook(() => useResult('r1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/results/r1', { token: 'mock-access-token' });
    expect(result.current.data).toEqual(data);
  });

  it('useResult is not enabled when id is empty', async () => {
    const { useResult } = await import('../useApi');
    const { result } = renderHook(() => useResult(''), { wrapper: createWrapper() });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('usePendingReviews fetches pending reviews', async () => {
    const data = [{ id: 'pr1', resultId: 'r1' }];
    mockApiFetch.mockResolvedValueOnce(data);

    const { usePendingReviews } = await import('../useApi');
    const { result } = renderHook(() => usePendingReviews(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/results/pending-review', {
      token: 'mock-access-token',
    });
    expect(result.current.data).toEqual(data);
  });

  it('useReviewResult sends review with corrections', async () => {
    mockApiFetch.mockResolvedValueOnce({ success: true });

    const { useReviewResult } = await import('../useApi');
    const { result } = renderHook(() => useReviewResult(), { wrapper: createWrapper() });

    const reviewPayload = { resultId: 'r1', corrections: [{ question: 1, score: 10 }] };

    await act(async () => {
      result.current.mutate(reviewPayload);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/results/r1/review', {
      method: 'POST',
      token: 'mock-access-token',
      body: JSON.stringify({ corrections: reviewPayload.corrections }),
    });
  });
});

// ─── Processing ────────────────────────────────────────────

describe('useApi — Processing', () => {
  it('useProcessEvaluation uploads file via apiUpload', async () => {
    const mockResult = { id: 'proc-1', status: 'completed' };
    mockApiUpload.mockResolvedValueOnce(mockResult);

    const { useProcessEvaluation } = await import('../useApi');
    const { result } = renderHook(() => useProcessEvaluation(), { wrapper: createWrapper() });

    const file = new File(['test-content'], 'test.pdf', { type: 'application/pdf' });

    await act(async () => {
      result.current.mutate({ evaluationId: 'eval-1', file });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiUpload).toHaveBeenCalledWith(
      '/api/evaluations/eval-1/process',
      expect.any(FormData),
      'mock-access-token'
    );

    // Verify the FormData contains the file
    const formData = mockApiUpload.mock.calls[0][1];
    expect(formData.get('file')).toBe(file);
  });
});

// ─── Dashboard ────────────────────────────────────────────

describe('useApi — Dashboard', () => {
  it('useDashboardStats fetches stats with polling interval', async () => {
    const data = { students: 120, evaluations: 45 };
    mockApiFetch.mockResolvedValueOnce(data);

    const { useDashboardStats } = await import('../useApi');
    const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/dashboard/teacher', {
      token: 'mock-access-token',
    });
    expect(result.current.data).toEqual(data);
  });
});

// ─── Courses ──────────────────────────────────────────────

describe('useApi — Courses', () => {
  it('useCourses fetches courses list', async () => {
    const data = [
      {
        id: 'c1',
        name: '1st A',
        grade: '1st',
        subject: 'Math',
        student_count: 30,
        created_at: '2024-01-01',
      },
    ];
    mockApiFetch.mockResolvedValueOnce(data);

    const { useCourses } = await import('../useApi');
    const { result } = renderHook(() => useCourses(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/courses', { token: 'mock-access-token' });
    expect(result.current.data).toEqual(data);
  });

  it('useCreateCourse sends POST with course data', async () => {
    const created = {
      id: 'c1',
      name: '1st A',
      grade: '1st',
      subject: 'Math',
      student_count: 0,
      created_at: '2024-01-01',
    };
    mockApiFetch.mockResolvedValueOnce(created);

    const { useCreateCourse } = await import('../useApi');
    const { result } = renderHook(() => useCreateCourse(), { wrapper: createWrapper() });

    const courseData = { name: '1st A', grade: '1st', subject: 'Math' };

    await act(async () => {
      result.current.mutate(courseData);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/courses', {
      method: 'POST',
      token: 'mock-access-token',
      body: JSON.stringify(courseData),
    });
    expect(result.current.data).toEqual(created);
  });

  it('useDeleteCourse sends DELETE request', async () => {
    mockApiFetch.mockResolvedValueOnce(undefined);

    const { useDeleteCourse } = await import('../useApi');
    const { result } = renderHook(() => useDeleteCourse(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate('c1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/courses/c1', {
      method: 'DELETE',
      token: 'mock-access-token',
    });
  });
});

// ─── Report ──────────────────────────────────────────────

describe('useApi — Report', () => {
  beforeEach(() => {
    // Stub URL.createObjectURL / revokeObjectURL for Blob download test
    vi.stubGlobal('URL', {
      ...globalThis.URL,
      createObjectURL: vi.fn(() => 'blob:mock-report'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('useGenerateReport fetches blob and triggers download', async () => {
    const pdfBlob = new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' });
    mockApiFetch.mockResolvedValueOnce(pdfBlob);

    const { useGenerateReport } = await import('../useApi');
    const { result } = renderHook(() => useGenerateReport(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate('result-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/results/result-1/report', {
      token: 'mock-access-token',
    });
    expect(URL.createObjectURL).toHaveBeenCalledWith(pdfBlob);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-report');
  });
});

// ─── Auth dependency ──────────────────────────────────────

describe('useApi — Auth gate', () => {
  it('queries are not enabled when isAuthenticated is false', async () => {
    setAuthenticated({ accessToken: null, isAuthenticated: false });

    const { useEvaluations } = await import('../useApi');
    const { result } = renderHook(() => useEvaluations(), { wrapper: createWrapper() });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('queries fetch token from useAuth and pass it to apiFetch', async () => {
    setAuthenticated({ accessToken: 'custom-token', isAuthenticated: true });
    mockApiFetch.mockResolvedValueOnce([{ id: 'e1' }]);

    const { useEvaluations } = await import('../useApi');
    const { result } = renderHook(() => useEvaluations(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/evaluations', {
      token: 'custom-token',
    });
  });
});
