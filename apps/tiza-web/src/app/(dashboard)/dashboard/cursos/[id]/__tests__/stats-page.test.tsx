import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ──────────────────────────────────────────────────

const mockParams = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => mockParams(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/auth', () => ({
  getToken: () => 'mock-token',
}));

vi.mock('@tiza/ui', () => ({
  Card: ({ children, title, className }: any) => (
    <div data-testid="card" className={className}>
      {title && <h3>{title}</h3>}
      {children}
    </div>
  ),
  Spinner: ({ size }: any) => (
    <div data-testid="spinner" data-size={size}>
      Cargando...
    </div>
  ),
  EmptyState: ({ title, description }: any) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
  ErrorMessage: ({ message, onDismiss }: any) => (
    <div data-testid="error-message" role="alert">
      {message}
    </div>
  ),
  Button: ({ children, onClick, ...rest }: any) => (
    <button onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function createMockResponse(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getModule() {
  return await import('../stats/page');
}

async function renderStatsPage() {
  const { default: CourseStatsPage } = await getModule();
  return render(<CourseStatsPage />);
}

const mockStatsData = {
  course_name: '1° A',
  total_students: 30,
  total_evaluations: 10,
  average_grade: 5.6,
  students: [
    { student_id: 's1', full_name: 'Ana García', latest_grade: 6.5 },
    { student_id: 's2', full_name: 'Benjamín Soto', latest_grade: 4.2 },
    { student_id: 's3', full_name: 'Catalina Rojas', latest_grade: 3.8 },
    { student_id: 's4', full_name: 'Diego Muñoz', latest_grade: null },
  ],
};

// ─── Tests ──────────────────────────────────────────────────

describe('CourseStatsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams.mockReturnValue({ id: 'course-1' });
  });

  it('muestra spinner durante la carga', async () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    await renderStatsPage();

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('muestra el nombre del curso y estadísticas', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(mockStatsData));

    await renderStatsPage();

    await waitFor(() => {
      expect(screen.getByText('1° A')).toBeInTheDocument();
    });

    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('Alumnos')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Evaluaciones')).toBeInTheDocument();
    const avgElements = screen.getAllByText('5.6');
    expect(avgElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Promedio')).toBeInTheDocument();
  });

  it('muestra el contador de sobresalientes', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(mockStatsData));

    await renderStatsPage();

    await waitFor(() => {
      const outstandingNums = screen.getAllByText('1');
      expect(outstandingNums.length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText('Sobresalientes')).toBeInTheDocument();
  });

  it('muestra la lista de estudiantes con sus notas', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(mockStatsData));

    await renderStatsPage();

    await waitFor(() => {
      expect(screen.getByText('Ana García')).toBeInTheDocument();
    });

    expect(screen.getByText('Benjamín Soto')).toBeInTheDocument();
    expect(screen.getByText('Catalina Rojas')).toBeInTheDocument();
    expect(screen.getByText('Diego Muñoz')).toBeInTheDocument();
  });

  it('categoriza estudiantes correctamente', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(mockStatsData));

    await renderStatsPage();

    await waitFor(() => {
      expect(screen.getByText('Sobresaliente')).toBeInTheDocument();
    });

    expect(screen.getByText('Adecuado')).toBeInTheDocument();
    expect(screen.getByText('Reforzar')).toBeInTheDocument();
    expect(screen.getByText('Sin evaluar')).toBeInTheDocument();
  });

  it('tiene enlace para volver a cursos', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(mockStatsData));

    await renderStatsPage();

    await waitFor(() => {
      const backLink = screen.getByText('Volver a cursos');
      expect(backLink.closest('a')).toHaveAttribute('href', '/dashboard/cursos');
    });
  });

  it('muestra empty state cuando no hay datos', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(null));

    await renderStatsPage();

    await waitFor(() => {
      expect(screen.getByText('Sin datos disponibles')).toBeInTheDocument();
    });
  });

  it('muestra error cuando la API falla', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await renderStatsPage();

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });
  });

  it('reintenta cargar al hacer clic en reintentar', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(createMockResponse(mockStatsData));

    await renderStatsPage();

    await waitFor(() => {
      expect(screen.getByText('Volver a cursos')).toBeInTheDocument();
    });
    expect(screen.getByTestId('error-message')).toBeInTheDocument();

    const retryBtn = screen.getByText('Reintentar');
    await userEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('1° A')).toBeInTheDocument();
    });
  });

  it('muestra las secciones de rendimiento', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(mockStatsData));

    await renderStatsPage();

    await waitFor(() => {
      expect(screen.getByText('Estadísticas y rendimiento')).toBeInTheDocument();
    });

    const cards = screen.getAllByTestId('card');
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });
});
