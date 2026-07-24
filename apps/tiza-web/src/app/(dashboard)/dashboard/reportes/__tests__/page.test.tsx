import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ─── Mocks ──────────────────────────────────────────────────

const mockUseDashboardStats = vi.fn();
vi.mock('@/hooks/useApi', () => ({
  useDashboardStats: (...args: any[]) => mockUseDashboardStats(...args),
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
}));

const mockStats = {
  average_grade: 5.6,
  total_evaluations: 25,
  total_students: 120,
  completed_this_week: 8,
};

function setDefaultMocks() {
  mockUseDashboardStats.mockReturnValue({
    data: mockStats,
    isLoading: false,
  });
}

async function getModule() {
  return await import('../page');
}

async function renderReportesPage() {
  const { default: ReportesPage } = await getModule();
  return render(<ReportesPage />);
}

describe('ReportesPage (Tiza)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultMocks();
  });

  it('muestra spinner durante la carga', async () => {
    mockUseDashboardStats.mockReturnValue({
      data: null,
      isLoading: true,
    });

    await renderReportesPage();

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renderiza el título', async () => {
    await renderReportesPage();

    expect(screen.getByText('Reportes y estadísticas')).toBeInTheDocument();
  });

  it('muestra el promedio general', async () => {
    await renderReportesPage();

    expect(screen.getByText('5.6')).toBeInTheDocument();
    expect(screen.getByText('Promedio general del curso')).toBeInTheDocument();
  });

  it('muestra guión cuando no hay average_grade', async () => {
    mockUseDashboardStats.mockReturnValue({
      data: { ...mockStats, average_grade: null },
      isLoading: false,
    });

    await renderReportesPage();

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('muestra estadísticas de actividad', async () => {
    await renderReportesPage();

    expect(screen.getByText('Evaluaciones totales')).toBeInTheDocument();
    expect(screen.getByText('Alumnos evaluados')).toBeInTheDocument();
    expect(screen.getByText('Corregidas esta semana')).toBeInTheDocument();
  });

  it('muestra los números de las stats', async () => {
    await renderReportesPage();

    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('muestra el tiempo ahorrado', async () => {
    await renderReportesPage();

    expect(screen.getByText(/horas/)).toBeInTheDocument();
  });

  it('muestra 0 cuando stats son null', async () => {
    mockUseDashboardStats.mockReturnValue({
      data: null,
      isLoading: false,
    });

    await renderReportesPage();

    // Should show 0 values
    const zeroElements = screen.getAllByText('0');
    expect(zeroElements.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
