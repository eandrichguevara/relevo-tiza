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
  return await import('../page');
}

describe('LandingPage (Tiza)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el header con el logo TIZA', async () => {
    const { default: HomePage } = await getModule();
    render(<HomePage />);

    expect(screen.getByText('TIZA')).toBeInTheDocument();
  });

  it('tiene enlaces de inicio de sesión y registro en el header', async () => {
    const { default: HomePage } = await getModule();
    render(<HomePage />);

    const loginLink = screen.getByText('Iniciar sesión');
    expect(loginLink.closest('a')).toHaveAttribute('href', '/login');

    const registerLink = screen.getByText('Registrarse gratis');
    expect(registerLink.closest('a')).toHaveAttribute('href', '/register');
  });

  it('renderiza el hero con título y CTA', async () => {
    const { default: HomePage } = await getModule();
    render(<HomePage />);

    expect(screen.getByText('Tu tiempo, tu enseñanza')).toBeInTheDocument();
    const cta = screen.getByText('Comienza gratis');
    expect(cta.closest('a')).toHaveAttribute('href', '/register');
  });

  it('muestra las 3 características principales', async () => {
    const { default: HomePage } = await getModule();
    render(<HomePage />);

    expect(screen.getByText('Ahorra 15 horas semanales')).toBeInTheDocument();
    expect(screen.getByText('Corrección inteligente')).toBeInTheDocument();
    expect(screen.getByText('Reportes detallados')).toBeInTheDocument();
  });

  it('renderiza el footer con copyright', async () => {
    const { default: HomePage } = await getModule();
    render(<HomePage />);

    const tizaElements = screen.getAllByText(/TIZA/);
    expect(tizaElements.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/en Chile/)).toBeInTheDocument();
  });
});
