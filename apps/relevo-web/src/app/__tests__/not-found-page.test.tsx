import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

async function getModule() {
  return await import('../not-found');
}

describe('NotFoundPage (Relevo)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el título 404', async () => {
    const { default: NotFound } = await getModule();
    render(<NotFound />);

    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renderiza el mensaje de página no encontrada', async () => {
    const { default: NotFound } = await getModule();
    render(<NotFound />);

    expect(screen.getByText('Página no encontrada')).toBeInTheDocument();
    expect(screen.getByText(/La página que buscas no existe o fue movida/)).toBeInTheDocument();
  });

  it('tiene un enlace para volver al inicio', async () => {
    const { default: NotFound } = await getModule();
    render(<NotFound />);

    const link = screen.getByText('Volver al inicio');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/');
  });
});
