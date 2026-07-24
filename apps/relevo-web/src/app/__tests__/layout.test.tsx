import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/font/google', () => ({
  Inter: () => ({ className: 'inter-font' }),
}));

vi.mock('../providers', () => ({
  Providers: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="providers">{children}</div>
  ),
}));

async function getModule() {
  return await import('../layout');
}

describe('RootLayout (Relevo)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza html con lang es-CL', async () => {
    const { default: RootLayout } = await getModule();
    render(
      <RootLayout>
        <span>test</span>
      </RootLayout>
    );

    expect(document.documentElement).toHaveAttribute('lang', 'es-CL');
  });

  it('envuelve children con Providers', async () => {
    const { default: RootLayout } = await getModule();
    render(
      <RootLayout>
        <span data-testid="child">content</span>
      </RootLayout>
    );

    expect(screen.getByTestId('providers')).toBeInTheDocument();
    expect(screen.getByTestId('providers')).toContainElement(screen.getByTestId('child'));
  });
});
