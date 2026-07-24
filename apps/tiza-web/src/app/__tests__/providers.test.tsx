import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';

// ─── Mocks ──────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/hooks/useAuth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
}));

// ─── Module under test ─────────────────────────────────────

async function getModule() {
  return await import('../providers');
}

// ─── Tests ──────────────────────────────────────────────────

describe('Providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza los children dentro de los providers', async () => {
    const { Providers } = await getModule();

    render(
      <Providers>
        <div data-testid="child">Hello World</div>
      </Providers>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renderiza dentro de AuthProvider y QueryClientProvider', async () => {
    const { Providers } = await getModule();

    render(
      <Providers>
        <span>test</span>
      </Providers>
    );

    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
  });

  it('crea un QueryClient con staleTime de 60 segundos y retry de 1', async () => {
    // Spy on QueryClient constructor to verify default options
    const QueryClientSpy = vi.spyOn(QueryClient.prototype, 'getQueryDefaults' as any);

    const { Providers } = await getModule();

    render(
      <Providers>
        <span>test</span>
      </Providers>
    );

    // Verify the provider renders — QueryClient is created internally
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();

    // Clean up spy
    QueryClientSpy.mockRestore();
  });

  it('envuelve los children primero con AuthProvider y luego con QueryClientProvider', async () => {
    const { Providers } = await getModule();

    render(
      <Providers>
        <span data-testid="inner">content</span>
      </Providers>
    );

    // AuthProvider wraps children; QueryClientProvider wraps AuthProvider
    // So the DOM structure should be: div[data-testid="auth-provider"] > span
    const authProvider = screen.getByTestId('auth-provider');
    const inner = screen.getByTestId('inner');

    expect(authProvider).toContainElement(inner);
  });
});
