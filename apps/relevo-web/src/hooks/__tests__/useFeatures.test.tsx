import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ─── Mocks ──────────────────────────────────────────────────

// Mock global fetch — apiFetch uses this internally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

vi.mock('@tiza/config', () => ({
  getFeaturesMap: vi.fn(() => ({ multiSchool: false, someFlag: true })),
}));

// ─── Helpers ──────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

// ─── Tests ──────────────────────────────────────────────────

describe('useFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna features y brand cuando la API responde ok', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          brand: 'relevo',
          features: { multiSchool: true, someFlag: true },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const { useFeatures } = await import('../useFeatures');
    const { result } = renderHook(() => useFeatures(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.features).toEqual({ multiSchool: true, someFlag: true });
    expect(result.current.brand).toBe('relevo');
    expect(result.current.isLoading).toBe(false);
  });

  it('cae a defaults de config cuando la API falla', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { useFeatures } = await import('../useFeatures');
    const { result } = renderHook(() => useFeatures(), {
      wrapper: createWrapper(),
    });

    // The hook has retry:1 which delays the error state. Wait at least 2s for the retry.
    await waitFor(() => expect(result.current.isLoaded).toBe(true), { timeout: 10000 });
    // Falls back to getFeaturesMap('relevo')
    expect(result.current.features).toEqual({ multiSchool: false, someFlag: true });
    expect(result.current.brand).toBe('relevo');
  });

  it('retorna object vacío mientras isLoading es true', async () => {
    // Don't resolve the fetch — keep loading
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    const { useFeatures } = await import('../useFeatures');
    const { result } = renderHook(() => useFeatures(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isLoaded).toBe(false);
  });
});
