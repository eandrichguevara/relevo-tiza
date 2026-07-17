import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock useRouter before any module imports
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

async function getModule() {
  return await import('../providers');
}

describe('Providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock session response for AuthProvider on mount
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ user: null, accessToken: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('renderiza children envueltos en AuthProvider y QueryClientProvider', async () => {
    const { Providers } = await getModule();
    render(
      <Providers>
        <div data-testid="child">App Content</div>
      </Providers>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('App Content')).toBeInTheDocument();
  });

  it('no crashea cuando no hay children', async () => {
    const { Providers } = await getModule();
    const { container } = render(<Providers>{null}</Providers>);
    expect(container.innerHTML).toBe('');
  });
});
