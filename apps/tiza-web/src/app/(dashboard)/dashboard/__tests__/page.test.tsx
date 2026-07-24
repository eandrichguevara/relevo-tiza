import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ──────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: (...args: any[]) => mockUseAuth(...args),
}));

const mockUseDashboardStats = vi.fn();
vi.mock('@/hooks/useApi', () => ({
  useDashboardStats: (...args: any[]) => mockUseDashboardStats(...args),
}));

const mockUseFeatures = vi.fn();
vi.mock('@/hooks/useFeatures', () => ({
  useFeatures: (...args: any[]) => mockUseFeatures(...args),
}));

vi.mock('@tiza/ui', () => ({
  Card: ({ children, title }: any) => (
    <div data-testid="card">
      {title && <h3>{title}</h3>}
      {children}
    </div>
  ),
  Spinner: ({ size }: any) => (
    <div data-testid="spinner" data-size={size}>
      Cargando...
    </div>
  ),
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
  EmptyState: ({ title, description, icon, action }: any) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {icon && <div data-testid="empty-icon">{icon}</div>}
      {action && <div data-testid="empty-action">{action}</div>}
    </div>
  ),
}));

// ─── Helpers ────────────────────────────────────────────────

const mockStats = {
  total_evaluations: 25,
  completed_this_week: 8,
  pending_review: 3,
  total_students: 120,
  average_grade: 5.6,
};

function setDefaultMocks() {
  mockUseAuth.mockReturnValue({
    user: { name: 'Profesor Test' },
  });
  mockUseDashboardStats.mockReturnValue({
    data: mockStats,
    isLoading: false,
  });
  mockUseFeatures.mockReturnValue({
    features: { chatSupport: false },
    isLoaded: true,
  });
}

async function getModule() {
  return await import('../page');
}

async function renderDashboardPage() {
  const { default: DashboardPage } = await getModule();
  return render(<DashboardPage />);
}

// ─── Tests ──────────────────────────────────────────────────

describe('DashboardPage (Tiza)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultMocks();
  });

  it('muestra el spinner durante la carga', async () => {
    mockUseDashboardStats.mockReturnValue({
      data: null,
      isLoading: true,
    });

    await renderDashboardPage();

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('saluda al usuario por su nombre', async () => {
    await renderDashboardPage();

    expect(screen.getByText('¡Hola, Profesor Test!')).toBeInTheDocument();
  });

  it('saluda con "Profesor" por defecto cuando no hay nombre', async () => {
    mockUseAuth.mockReturnValue({ user: null });

    await renderDashboardPage();

    expect(screen.getByText('¡Hola, Profesor!')).toBeInTheDocument();
  });

  it('muestra las cards de estadísticas', async () => {
    await renderDashboardPage();

    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('Evaluaciones')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Esta semana')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Por revisar')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('Alumnos')).toBeInTheDocument();
    expect(screen.getByText('5.6')).toBeInTheDocument();
    expect(screen.getByText('Promedio')).toBeInTheDocument();
  });

  it('muestra guión cuando no hay average_grade', async () => {
    mockUseDashboardStats.mockReturnValue({
      data: { ...mockStats, average_grade: null },
      isLoading: false,
    });

    await renderDashboardPage();

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('tiene enlaces a acciones rápidas', async () => {
    await renderDashboardPage();

    const nuevaEvalElements = screen.getAllByText('Nueva evaluación');
    expect(nuevaEvalElements.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Revisar pendientes')).toBeInTheDocument();
    expect(screen.getByText('Ver evaluaciones')).toBeInTheDocument();
  });

  it('no muestra chat support cuando feature flag está desactivado', async () => {
    mockUseFeatures.mockReturnValue({
      features: { chatSupport: false },
      isLoaded: true,
    });

    await renderDashboardPage();

    expect(screen.queryByLabelText('Abrir chat de soporte')).not.toBeInTheDocument();
  });

  it('muestra chat support cuando feature flag está activo', async () => {
    mockUseFeatures.mockReturnValue({
      features: { chatSupport: true },
      isLoaded: true,
    });

    await renderDashboardPage();

    expect(screen.getByLabelText('Abrir chat de soporte')).toBeInTheDocument();
  });

  it('no muestra chat cuando isLoaded es false', async () => {
    mockUseFeatures.mockReturnValue({
      features: {},
      isLoaded: false,
    });

    await renderDashboardPage();

    expect(screen.queryByLabelText('Abrir chat de soporte')).not.toBeInTheDocument();
  });

  it('tiene enlace a nueva evaluación en el header', async () => {
    await renderDashboardPage();

    const newEvalLinks = screen.getAllByText('Nueva evaluación');
    // First one is the header link
    expect(newEvalLinks[0].closest('a')).toHaveAttribute('href', '/dashboard/evaluaciones/nueva');
  });

  it('tiene enlaces correctos en acciones rápidas', async () => {
    await renderDashboardPage();

    const evaluacionesLink = screen.getByText('Ver evaluaciones').closest('a');
    expect(evaluacionesLink).toHaveAttribute('href', '/dashboard/evaluaciones');
  });
});
