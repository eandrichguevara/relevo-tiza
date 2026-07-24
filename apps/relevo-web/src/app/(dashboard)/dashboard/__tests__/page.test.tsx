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

const mockUseExecutiveStats = vi.fn();
vi.mock('@/hooks/useRelevoApi', () => ({
  useExecutiveStats: (...args: any[]) => mockUseExecutiveStats(...args),
}));

const mockUseFeatures = vi.fn();
vi.mock('@/hooks/useFeatures', () => ({
  useFeatures: (...args: any[]) => mockUseFeatures(...args),
}));

const mockUseActiveTenant = vi.fn();
vi.mock('@/hooks/ActiveTenantContext', () => ({
  useActiveTenant: (...args: any[]) => mockUseActiveTenant(...args),
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

// ─── Helpers ────────────────────────────────────────────────

const mockStats = {
  total_schools: 5,
  total_teachers: 120,
  total_evaluations: 350,
  average_performance: 5.8,
};

function setDefaultMocks() {
  mockUseExecutiveStats.mockReturnValue({
    data: mockStats,
    isLoading: false,
  });
  mockUseFeatures.mockReturnValue({
    features: { executiveKPIs: true },
    isLoaded: true,
  });
  mockUseActiveTenant.mockReturnValue({
    activeTenant: { name: 'Colegio Test' },
  });
}

async function getModule() {
  return await import('../page');
}

async function renderDashboardPage() {
  const { default: RelevoDashboard } = await getModule();
  return render(<RelevoDashboard />);
}

// ─── Tests ──────────────────────────────────────────────────

describe('RelevoDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultMocks();
  });

  it('muestra spinner durante la carga', async () => {
    mockUseExecutiveStats.mockReturnValue({
      data: null,
      isLoading: true,
    });

    await renderDashboardPage();

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renderiza el título del dashboard', async () => {
    await renderDashboardPage();

    expect(screen.getByText('Dashboard ejecutivo')).toBeInTheDocument();
    expect(screen.getByText('Visión general de todos tus colegios')).toBeInTheDocument();
  });

  it('muestra el badge del tenant activo', async () => {
    await renderDashboardPage();

    expect(screen.getByText('Colegio Test')).toBeInTheDocument();
  });

  it('no muestra badge de tenant cuando no hay activeTenant', async () => {
    mockUseActiveTenant.mockReturnValue({ activeTenant: null });

    await renderDashboardPage();

    expect(screen.queryByTestId('badge')).not.toBeInTheDocument();
  });

  it('muestra KPIs ejecutivos cuando el feature flag está activo', async () => {
    await renderDashboardPage();

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Colegios activos')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('Profesores')).toBeInTheDocument();
    expect(screen.getByText('350')).toBeInTheDocument();
    expect(screen.getByText('Evaluaciones')).toBeInTheDocument();
    expect(screen.getByText('5.8')).toBeInTheDocument();
    expect(screen.getByText('Rendimiento promedio')).toBeInTheDocument();
  });

  it('muestra empty state cuando executiveKPIs feature está desactivado', async () => {
    mockUseFeatures.mockReturnValue({
      features: { executiveKPIs: false },
      isLoaded: true,
    });

    await renderDashboardPage();

    expect(screen.getByText('KPIs ejecutivos no disponibles')).toBeInTheDocument();
    expect(screen.getByText(/desactivada para tu plan actual/)).toBeInTheDocument();
  });

  it('muestra empty state cuando isLoaded es false (ternary fallback)', async () => {
    mockUseFeatures.mockReturnValue({
      features: {},
      isLoaded: false,
    });

    await renderDashboardPage();

    // When isLoaded is false, the ternary (isLoaded && features.executiveKPIs) is false
    // so it falls through to the else branch showing the empty state
    expect(screen.queryByText('5')).not.toBeInTheDocument();
    expect(screen.getByText('KPIs ejecutivos no disponibles')).toBeInTheDocument();
  });

  it('muestra valores por defecto cuando stats son null', async () => {
    mockUseExecutiveStats.mockReturnValue({
      data: null,
      isLoading: false,
    });

    await renderDashboardPage();

    const zeroElements = screen.getAllByText('0');
    expect(zeroElements.length).toBeGreaterThanOrEqual(3);
  });

  it('muestra guión cuando average_performance es null', async () => {
    mockUseExecutiveStats.mockReturnValue({
      data: { ...mockStats, average_performance: null },
      isLoading: false,
    });

    await renderDashboardPage();

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('muestra la card de tendencia', async () => {
    await renderDashboardPage();

    expect(screen.getByText('Tendencia de rendimiento')).toBeInTheDocument();
    expect(screen.getByText(/próximamente/)).toBeInTheDocument();
  });
});
