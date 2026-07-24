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

const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: (...args: any[]) => mockUseAuth(...args),
}));

const mockUseEvaluation = vi.fn();
const mockUseResults = vi.fn();
const mockUseProcessEvaluation = vi.fn();
const mockUseGenerateReport = vi.fn();
vi.mock('@/hooks/useApi', () => ({
  useEvaluation: (...args: any[]) => mockUseEvaluation(...args),
  useResults: (...args: any[]) => mockUseResults(...args),
  useProcessEvaluation: (...args: any[]) => mockUseProcessEvaluation(...args),
  useGenerateReport: (...args: any[]) => mockUseGenerateReport(...args),
}));

vi.mock('@tiza/ui', () => ({
  Card: ({ children, title }: any) => (
    <div data-testid="card">
      {title && <h3>{title}</h3>}
      {children}
    </div>
  ),
  Button: ({ children, loading, disabled, onClick, variant, className, ...rest }: any) => (
    <button disabled={disabled || loading} onClick={onClick} className={className} {...rest}>
      {loading ? 'Procesando...' : children}
    </button>
  ),
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
  Spinner: ({ size }: any) => (
    <div data-testid="spinner" data-size={size}>
      Cargando...
    </div>
  ),
  EmptyState: ({ title, description, icon }: any) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {icon && <div data-testid="empty-icon">{icon}</div>}
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  Upload: ({ size }: any) => <span data-testid="icon-upload">Upload</span>,
  FileText: ({ size }: any) => <span data-testid="icon-filetext">FileText</span>,
  Download: ({ size }: any) => <span data-testid="icon-download">Download</span>,
  AlertTriangle: ({ size }: any) => <span data-testid="icon-alert">Alert</span>,
  CheckCircle: ({ size }: any) => <span data-testid="icon-check">Check</span>,
  Eye: ({ size }: any) => <span data-testid="icon-eye">Eye</span>,
}));

// ─── Test Data ──────────────────────────────────────────────

const mockEvaluation = {
  id: 'eval-1',
  title: 'Prueba de Matemáticas',
  subject: 'Matemáticas',
  grade: '1°',
  status: 'completed',
  rubric: [
    { question_number: 1, statement: 'Q1', type: 'written', criteria: [] },
    { question_number: 2, statement: 'Q2', type: 'multiple_choice', max_score: 10 },
  ],
  created_at: '2024-03-15T12:00:00Z',
};

const mockResults = [
  {
    id: 'r1',
    student_code: 'ALUMNO001',
    confidence: 0.95,
    final_grade: 6.5,
    requires_review: false,
  },
  {
    id: 'r2',
    student_code: 'ALUMNO002',
    confidence: 0.55,
    final_grade: 4.2,
    requires_review: true,
  },
];

function setDefaultMocks() {
  mockParams.mockReturnValue({ id: 'eval-1' });
  mockUseAuth.mockReturnValue({
    token: 'fake-token',
  });
  mockUseEvaluation.mockReturnValue({
    data: mockEvaluation,
    isLoading: false,
  });
  mockUseResults.mockReturnValue({
    data: mockResults,
    isLoading: false,
  });
  mockUseProcessEvaluation.mockReturnValue({
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

async function renderEvaluationDetailPage() {
  const { default: EvaluationDetailPage } = await getModule();
  return render(<EvaluationDetailPage />);
}

// ─── Tests ──────────────────────────────────────────────────

describe('EvaluationDetailPage (Tiza)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  // ─── Loading State ────────────────────────────────────

  it('muestra spinner mientras carga la evaluación', async () => {
    mockUseEvaluation.mockReturnValue({
      data: null,
      isLoading: true,
    });

    await renderEvaluationDetailPage();

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    // Should not render evaluation content
    expect(screen.queryByText('Prueba de Matemáticas')).not.toBeInTheDocument();
  });

  // ─── Not Found State ──────────────────────────────────

  it('muestra "Evaluación no encontrada" cuando no hay evaluación', async () => {
    mockUseEvaluation.mockReturnValue({
      data: null,
      isLoading: false,
    });

    await renderEvaluationDetailPage();

    expect(screen.getByText('Evaluación no encontrada')).toBeInTheDocument();
  });

  // ─── Render Completo ──────────────────────────────────

  it('renderiza el título de la evaluación', async () => {
    await renderEvaluationDetailPage();

    expect(screen.getByText('Prueba de Matemáticas')).toBeInTheDocument();
  });

  it('renderiza materia y grado', async () => {
    await renderEvaluationDetailPage();

    expect(screen.getByText('Matemáticas — 1°')).toBeInTheDocument();
  });

  it('muestra el badge con el estado de la evaluación', async () => {
    await renderEvaluationDetailPage();

    const badges = screen.getAllByTestId('badge');
    const statusBadge = badges.find((b) => b.textContent === 'completed');
    expect(statusBadge).toBeInTheDocument();
  });

  it('badge usa variant success para estado completed', async () => {
    await renderEvaluationDetailPage();

    const badges = screen.getAllByTestId('badge');
    const statusBadge = badges.find((b) => b.textContent === 'completed');
    expect(statusBadge).toHaveAttribute('data-variant', 'success');
  });

  it('badge usa variant warning para estado pending', async () => {
    mockUseEvaluation.mockReturnValue({
      data: { ...mockEvaluation, status: 'pending' },
      isLoading: false,
    });

    await renderEvaluationDetailPage();

    const badges = screen.getAllByTestId('badge');
    const statusBadge = badges.find((b) => b.textContent === 'pending');
    expect(statusBadge).toHaveAttribute('data-variant', 'warning');
  });

  // ─── Action Cards ─────────────────────────────────────

  it('muestra el botón "Descargar PDF"', async () => {
    await renderEvaluationDetailPage();

    expect(screen.getByText('Descargar PDF')).toBeInTheDocument();
  });

  it('muestra el botón "Subir y procesar"', async () => {
    await renderEvaluationDetailPage();

    expect(screen.getByText('Subir y procesar')).toBeInTheDocument();
  });

  it('muestra la card de Rúbrica con cantidad de preguntas', async () => {
    await renderEvaluationDetailPage();

    expect(screen.getByText('2 preguntas definidas')).toBeInTheDocument();
  });

  it('rubrica muestra "Sin rúbrica" cuando no hay array', async () => {
    mockUseEvaluation.mockReturnValue({
      data: { ...mockEvaluation, rubric: null },
      isLoading: false,
    });

    await renderEvaluationDetailPage();

    expect(screen.getByText('Sin rúbrica')).toBeInTheDocument();
  });

  // ─── Results ──────────────────────────────────────────

  it('muestra el título "Resultados"', async () => {
    await renderEvaluationDetailPage();

    expect(screen.getByText('Resultados')).toBeInTheDocument();
  });

  it('muestra lista de resultados con datos', async () => {
    await renderEvaluationDetailPage();

    expect(screen.getByText('ALUMNO001')).toBeInTheDocument();
    expect(screen.getByText('ALUMNO002')).toBeInTheDocument();
  });

  it('muestra nota y confianza en resultados', async () => {
    await renderEvaluationDetailPage();

    expect(screen.getByText(/Nota: 6.5/)).toBeInTheDocument();
    expect(screen.getByText(/Confianza: 95%/)).toBeInTheDocument();
    expect(screen.getByText(/Nota: 4.2/)).toBeInTheDocument();
    expect(screen.getByText(/Confianza: 55%/)).toBeInTheDocument();
  });

  it('muestra badge "OK" para resultado sin requires_review', async () => {
    await renderEvaluationDetailPage();

    const badges = screen.getAllByTestId('badge');
    const okBadge = badges.find((b) => b.textContent === 'OK');
    expect(okBadge).toBeInTheDocument();
    expect(okBadge).toHaveAttribute('data-variant', 'success');
  });

  it('muestra badge "Revisar" para resultado con requires_review', async () => {
    await renderEvaluationDetailPage();

    const badges = screen.getAllByTestId('badge');
    const reviewBadge = badges.find((b) => b.textContent === 'Revisar');
    expect(reviewBadge).toBeInTheDocument();
    expect(reviewBadge).toHaveAttribute('data-variant', 'warning');
  });

  it('tiene enlace a revisión para cada resultado', async () => {
    await renderEvaluationDetailPage();

    const reviewLinks = screen.getAllByLabelText(/Revisar resultado de/);
    expect(reviewLinks.length).toBe(2);
    expect(reviewLinks[0]).toHaveAttribute('href', '/dashboard/revisar/r1');
    expect(reviewLinks[1]).toHaveAttribute('href', '/dashboard/revisar/r2');
  });

  it('muestra empty state cuando no hay resultados', async () => {
    mockUseResults.mockReturnValue({
      data: [],
      isLoading: false,
    });

    await renderEvaluationDetailPage();

    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
    expect(
      screen.getByText('Sube un PDF escaneado para procesar las respuestas')
    ).toBeInTheDocument();
  });

  it('muestra loading spinner mientras cargan resultados', async () => {
    mockUseResults.mockReturnValue({
      data: null,
      isLoading: true,
    });

    await renderEvaluationDetailPage();

    const spinners = screen.getAllByTestId('spinner');
    expect(spinners.length).toBeGreaterThanOrEqual(1);
  });

  it('muestra "--" para nota cuando final_grade es null', async () => {
    mockUseResults.mockReturnValue({
      data: [
        {
          id: 'r1',
          student_code: 'ALUMNO001',
          confidence: 0.8,
          final_grade: null,
          requires_review: false,
        },
      ],
      isLoading: false,
    });

    await renderEvaluationDetailPage();

    expect(screen.getByText(/Nota: —/)).toBeInTheDocument();
  });

  // ─── Back Link ────────────────────────────────────────

  it('tiene enlace para volver a evaluaciones', async () => {
    await renderEvaluationDetailPage();

    const backLink = screen.getByText('← Volver a evaluaciones');
    expect(backLink.closest('a')).toHaveAttribute('href', '/dashboard/evaluaciones');
  });

  // ─── Upload ───────────────────────────────────────────

  it('sube archivo PDF al hacer clic en Subir y procesar', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseProcessEvaluation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    await renderEvaluationDetailPage();

    // Click upload button
    const uploadBtn = screen.getByText('Subir y procesar');
    await userEvent.click(uploadBtn);

    // File input should be triggered (not directly testable without DOM file API)
    const fileInput = screen.getByLabelText('Seleccionar archivo PDF escaneado');
    expect(fileInput).toBeInTheDocument();
  });

  it('procesa la subida y muestra alert de éxito', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseProcessEvaluation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    await renderEvaluationDetailPage();

    // Simulate file selection
    const fileInput = screen.getByLabelText('Seleccionar archivo PDF escaneado');
    const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        evaluationId: 'eval-1',
        file: expect.any(File),
      });
    });

    expect(window.alert).toHaveBeenCalledWith('¡Procesamiento iniciado!');
  });

  it('muestra error si falla el procesamiento', async () => {
    const mockMutateAsync = vi.fn().mockRejectedValue({ message: 'Error al procesar' });
    mockUseProcessEvaluation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    await renderEvaluationDetailPage();

    const fileInput = screen.getByLabelText('Seleccionar archivo PDF escaneado');
    const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Error al procesar: Error al procesar');
    });
  });

  it('muestra loading en botón de subir durante el procesamiento', async () => {
    mockUseProcessEvaluation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    });

    await renderEvaluationDetailPage();

    const uploadBtn = screen.getByText('Subir y procesar');
    expect(uploadBtn).toBeDisabled();
  });

  // ─── Download PDF ─────────────────────────────────────

  it('descarga PDF al hacer clic en Descargar PDF', async () => {
    // Mock fetch
    const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' });
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });
    vi.stubGlobal('fetch', mockFetch);

    // Mock URL.createObjectURL
    const mockUrl = 'blob:http://localhost/test';
    vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue(mockUrl) });

    await renderEvaluationDetailPage();

    const downloadBtn = screen.getByText('Descargar PDF');
    await userEvent.click(downloadBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/evaluations/eval-1/pdf'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer fake-token',
            'X-Tenant-Brand': 'tiza',
          }),
        })
      );
    });

    expect(window.open).toHaveBeenCalledWith(mockUrl);

    vi.unstubAllGlobals();
  });

  it('muestra alert si falla la descarga del PDF', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
    });
    vi.stubGlobal('fetch', mockFetch);

    await renderEvaluationDetailPage();

    const downloadBtn = screen.getByText('Descargar PDF');
    await userEvent.click(downloadBtn);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Error al generar PDF');
    });

    vi.unstubAllGlobals();
  });
});
