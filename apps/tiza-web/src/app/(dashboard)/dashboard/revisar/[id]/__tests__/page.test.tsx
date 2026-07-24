import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ──────────────────────────────────────────────────

const mockParams = vi.fn();
const mockRouterPush = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => mockParams(),
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockUseResult = vi.fn();
const mockUseReviewResult = vi.fn();
const mockUseGenerateReport = vi.fn();
vi.mock('@/hooks/useApi', () => ({
  useResult: (...args: any[]) => mockUseResult(...args),
  useReviewResult: (...args: any[]) => mockUseReviewResult(...args),
  useGenerateReport: (...args: any[]) => mockUseGenerateReport(...args),
}));

vi.mock('@tiza/ui', () => ({
  Card: ({ children, title }: any) => (
    <div data-testid="card">
      {title && <h3>{title}</h3>}
      {children}
    </div>
  ),
  Input: ({ label, value, onChange, type, min, max, placeholder, ...rest }: any) => (
    <div>
      <label>{label}</label>
      <input
        type={type || 'text'}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        placeholder={placeholder}
        aria-label={label}
        {...rest}
      />
    </div>
  ),
  Button: ({ children, loading, disabled, onClick, variant, ...rest }: any) => (
    <button disabled={disabled || loading} onClick={onClick} {...rest}>
      {loading ? 'Guardando...' : children}
    </button>
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
}));

// ─── Test Data ──────────────────────────────────────────────

const mockResult = {
  id: 'r1',
  student_code: 'ALUMNO001',
  confidence: 0.85,
  final_grade: 6.2,
  answers: [
    {
      question_number: 1,
      score: 5,
      max_score: 7,
      student_answer: 'Answer text 1',
      ai_feedback: 'Good answer',
      requires_review: false,
    },
    {
      question_number: 2,
      score: 4,
      max_score: 6,
      student_answer: 'Answer text 2',
      ai_feedback: 'Needs improvement',
      requires_review: true,
    },
  ],
};

function setDefaultMocks() {
  mockParams.mockReturnValue({ id: 'r1' });
  mockUseResult.mockReturnValue({
    data: mockResult,
    isLoading: false,
  });
  mockUseReviewResult.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  });
  mockUseGenerateReport.mockReturnValue({
    mutate: vi.fn(),
  });
}

async function getModule() {
  return await import('../page');
}

async function renderReviewPage() {
  const { default: ReviewDetailPage } = await getModule();
  return render(<ReviewDetailPage />);
}

// ─── Tests ──────────────────────────────────────────────────

describe('ReviewDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('muestra spinner durante la carga', async () => {
    mockUseResult.mockReturnValue({
      data: null,
      isLoading: true,
    });

    await renderReviewPage();

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('muestra "Resultado no encontrado" cuando no hay data', async () => {
    mockUseResult.mockReturnValue({
      data: null,
      isLoading: false,
    });

    await renderReviewPage();

    expect(screen.getByText('Resultado no encontrado')).toBeInTheDocument();
  });

  it('muestra el código del estudiante y la confianza', async () => {
    await renderReviewPage();

    expect(screen.getByText(/Revisión: ALUMNO001/)).toBeInTheDocument();
    expect(screen.getByText(/Confianza IA: 85%/)).toBeInTheDocument();
    expect(screen.getByText(/Nota sugerida: 6.2/)).toBeInTheDocument();
  });

  it('muestra las preguntas con sus respuestas', async () => {
    await renderReviewPage();

    expect(screen.getByText(/Pregunta 1/)).toBeInTheDocument();
    expect(screen.getByText(/Pregunta 2/)).toBeInTheDocument();
    expect(screen.getByText('Answer text 1')).toBeInTheDocument();
    expect(screen.getByText('Answer text 2')).toBeInTheDocument();
    expect(screen.getByText('Good answer')).toBeInTheDocument();
    expect(screen.getByText('Needs improvement')).toBeInTheDocument();
  });

  it('muestra badges según requires_review', async () => {
    await renderReviewPage();

    const badges = screen.getAllByTestId('badge');
    const badgeTexts = badges.map((b) => b.textContent?.trim());
    expect(badgeTexts).toContain('OK');
    expect(badgeTexts).toContain('Revisar');
  });

  it('no renderiza answers si no es array', async () => {
    mockUseResult.mockReturnValue({
      data: { ...mockResult, answers: null },
      isLoading: false,
    });

    await renderReviewPage();

    // Should render without answers section
    expect(screen.getByText(/Revisión: ALUMNO001/)).toBeInTheDocument();
    expect(screen.queryByText(/Pregunta 1/)).not.toBeInTheDocument();
  });

  it('tiene botón de reporte y guardar', async () => {
    await renderReviewPage();

    expect(screen.getByText('Reporte')).toBeInTheDocument();
    expect(screen.getByText('Guardar revisión')).toBeInTheDocument();
  });

  it('tiene enlace para volver a pendientes', async () => {
    await renderReviewPage();

    const backLink = screen.getByText('← Volver a pendientes');
    expect(backLink.closest('a')).toHaveAttribute('href', '/dashboard/revisar');
  });

  it('tiene inputs para puntuación y feedback', async () => {
    await renderReviewPage();

    const scoreInputs = screen.getAllByLabelText('Tu puntuación');
    expect(scoreInputs.length).toBe(2);

    const feedbackInputs = screen.getAllByLabelText('Tu feedback');
    expect(feedbackInputs.length).toBe(2);
  });

  it('guarda la revisión correctamente', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseReviewResult.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    await renderReviewPage();

    const saveBtn = screen.getByText('Guardar revisión');
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });

    expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/revisar');
  });

  it('muestra error si falla al guardar', async () => {
    const mockMutateAsync = vi.fn().mockRejectedValue({ message: 'Error al guardar' });
    mockUseReviewResult.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    await renderReviewPage();

    const saveBtn = screen.getByText('Guardar revisión');
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalled();
    });
  });

  it('genera reporte al hacer clic en Reporte', async () => {
    const mockMutate = vi.fn();
    mockUseGenerateReport.mockReturnValue({
      mutate: mockMutate,
    });

    await renderReviewPage();

    const reportBtn = screen.getByText('Reporte');
    await userEvent.click(reportBtn);

    expect(mockMutate).toHaveBeenCalledWith('r1');
  });
});
