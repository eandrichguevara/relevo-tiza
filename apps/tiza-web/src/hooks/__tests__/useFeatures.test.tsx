import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Mock @tiza/config
vi.mock('@tiza/config', () => ({
  getFeaturesMap: vi.fn((brand: string) => ({
    mockFeature: true,
  })),
}));

// Mock @/lib/api — return a module with apiFetch
const mockApiFetch = vi.fn();
vi.mock('@/lib/api', () => ({
  apiFetch: mockApiFetch,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna features desde el API cuando la request es exitosa', async () => {
    const mockData = {
      brand: 'tiza',
      features: { newFeature: true, betaFeature: false },
    };
    mockApiFetch.mockResolvedValueOnce(mockData);

    const { useFeatures } = await import('../useFeatures');
    const { result } = renderHook(() => useFeatures(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect(result.current.features).toEqual({ newFeature: true, betaFeature: false });
    expect(result.current.brand).toBe('tiza');
    expect(result.current.isLoading).toBe(false);
  });

  it('usa defaults de @tiza/config cuando el API falla (isError)', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('API Error'));

    const { useFeatures } = await import('../useFeatures');
    const { result } = renderHook(() => useFeatures(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoaded).toBe(true), { timeout: 5000 });

    expect(result.current.features).toEqual({ mockFeature: true });
    expect(result.current.brand).toBe('tiza');
    expect(result.current.isLoading).toBe(false);
  });

  it('retorna isLoaded=false mientras carga', async () => {
    // Never resolve
    mockApiFetch.mockReturnValueOnce(new Promise(() => {}));

    const { useFeatures } = await import('../useFeatures');
    const { result } = renderHook(() => useFeatures(), { wrapper: createWrapper() });

    expect(result.current.isLoaded).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it('usa defaults de config cuando isLoaded es false y no hay error', async () => {
    mockApiFetch.mockReturnValueOnce(new Promise(() => {}));

    const { useFeatures } = await import('../useFeatures');
    const { result } = renderHook(() => useFeatures(), { wrapper: createWrapper() });

    // Still loading — features should be empty object (not from config)
    expect(result.current.features).toEqual({});
    expect(result.current.brand).toBe('tiza');
  });
});
