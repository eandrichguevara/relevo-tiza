import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ─── Mocks ──────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockUsePendingReviews = vi.fn();
vi.mock('@/hooks/useApi', () => ({
  usePendingReviews: (...args: any[]) => mockUsePendingReviews(...args),
}));

vi.mock('@tiza/ui', () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  Spinner: ({ size }: any) => (
    <div data-testid="spinner" data-size={size}>
      Cargando...
    </div>
  ),
  EmptyState: ({ title, description, icon }: any) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {icon}
    </div>
  ),
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

const mockPending = [
  { id: 'pr1', student_code: 'ALUMNO001', confidence: 0.75 },
  { id: 'pr2', student_code: 'ALUMNO002', confidence: 0.45 },
];

function setDefaultMocks() {
  mockUsePendingReviews.mockReturnValue({
    data: mockPending,
    isLoading: false,
  });
}

async function getModule() {
  return await import('../page');
}

async function renderRevisarPage() {
  const { default: RevisarPage } = await getModule();
  return render(<RevisarPage />);
}

describe('RevisarPage (Tiza)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultMocks();
  });

  it('muestra spinner durante la carga', async () => {
    mockUsePendingReviews.mockReturnValue({
      data: null,
      isLoading: true,
    });

    await renderRevisarPage();

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renderiza el título', async () => {
    await renderRevisarPage();

    expect(screen.getByText('Revisión pendiente')).toBeInTheDocument();
  });

  it('muestra empty state cuando no hay pendientes', async () => {
    mockUsePendingReviews.mockReturnValue({
      data: [],
      isLoading: false,
    });

    await renderRevisarPage();

    expect(screen.getByText('¡Todo al día!')).toBeInTheDocument();
    expect(screen.getByText('No hay evaluaciones pendientes de revisión')).toBeInTheDocument();
  });

  it('muestra la lista de revisiones pendientes', async () => {
    await renderRevisarPage();

    expect(screen.getByText('ALUMNO001')).toBeInTheDocument();
    expect(screen.getByText('ALUMNO002')).toBeInTheDocument();
  });

  it('muestra el porcentaje de confianza', async () => {
    await renderRevisarPage();

    expect(screen.getByText('Confianza IA: 75%')).toBeInTheDocument();
    expect(screen.getByText('Confianza IA: 45%')).toBeInTheDocument();
  });

  it('tiene badge de "Requiere revisión" para cada item', async () => {
    await renderRevisarPage();

    const badges = screen.getAllByTestId('badge');
    expect(badges.length).toBe(2);
    badges.forEach((badge) => {
      expect(badge).toHaveTextContent('Requiere revisión');
    });
  });

  it('tiene enlaces al detalle de revisión para cada pendiente', async () => {
    await renderRevisarPage();

    const links = screen.getAllByRole('link');
    expect(links.length).toBe(2);
    expect(links[0]).toHaveAttribute('href', '/dashboard/revisar/pr1');
    expect(links[1]).toHaveAttribute('href', '/dashboard/revisar/pr2');
  });
});
