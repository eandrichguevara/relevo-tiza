import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

async function getModule() {
  return await import('../(auth)/layout');
}

describe('AuthLayout (Tiza)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el título TIZA y el subtítulo', async () => {
    const { default: AuthLayout } = await getModule();
    render(
      <AuthLayout>
        <span>child</span>
      </AuthLayout>
    );

    expect(screen.getByText('TIZA')).toBeInTheDocument();
    expect(screen.getByText('Tu tiempo, tu enseñanza')).toBeInTheDocument();
  });

  it('renderiza los children dentro del layout', async () => {
    const { default: AuthLayout } = await getModule();
    render(
      <AuthLayout>
        <div data-testid="child">content</div>
      </AuthLayout>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('envuelve children en un contenedor con max-w-md', async () => {
    const { default: AuthLayout } = await getModule();
    const { container } = render(
      <AuthLayout>
        <span>test</span>
      </AuthLayout>
    );

    const wrapper = container.querySelector('.max-w-md');
    expect(wrapper).toBeInTheDocument();
  });
});
