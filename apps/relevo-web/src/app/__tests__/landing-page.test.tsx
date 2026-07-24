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

describe('LandingPage (Relevo)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el header con el logo RELEVO', async () => {
    const { default: RelevoHome } = await getModule();
    render(<RelevoHome />);

    expect(screen.getByText('RELEVO')).toBeInTheDocument();
  });

  it('tiene enlaces de inicio de sesión y demo en el header', async () => {
    const { default: RelevoHome } = await getModule();
    render(<RelevoHome />);

    const loginLink = screen.getByText('Iniciar sesión');
    expect(loginLink.closest('a')).toHaveAttribute('href', '/login');

    const demoLink = screen.getByText('Solicitar demo');
    expect(demoLink.closest('a')).toHaveAttribute('href', '/register');
  });

  it('renderiza el hero con título y CTA', async () => {
    const { default: RelevoHome } = await getModule();
    render(<RelevoHome />);

    expect(screen.getByText('Datos que transforman la educación')).toBeInTheDocument();
    const cta = screen.getByText('Agenda una demo');
    expect(cta.closest('a')).toHaveAttribute('href', '/register');
  });

  it('muestra las 4 características principales', async () => {
    const { default: RelevoHome } = await getModule();
    render(<RelevoHome />);

    expect(screen.getByText('KPIs en tiempo real')).toBeInTheDocument();
    expect(screen.getByText('Multi-colegio')).toBeInTheDocument();
    expect(screen.getByText('Predicción SIMCE')).toBeInTheDocument();
    expect(screen.getByText('Datos en Chile')).toBeInTheDocument();
  });

  it('renderiza el footer con copyright', async () => {
    const { default: RelevoHome } = await getModule();
    render(<RelevoHome />);

    expect(screen.getByText(/RELEVO SpA/)).toBeInTheDocument();
    expect(screen.getByText(/Santiago, Chile/)).toBeInTheDocument();
  });
});
