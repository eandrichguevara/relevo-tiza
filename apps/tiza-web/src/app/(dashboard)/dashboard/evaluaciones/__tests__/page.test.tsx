import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ──────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockUseEvaluations = vi.fn();
const mockUseDeleteEvaluation = vi.fn();
vi.mock('@/hooks/useApi', () => ({
  useEvaluations: (...args: any[]) => mockUseEvaluations(...args),
  useDeleteEvaluation: (...args: any[]) => mockUseDeleteEvaluation(...args),
}));

vi.mock('@tiza/ui', () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  Button: ({ children, loading, disabled, ...rest }: any) => (
    <button disabled={disabled || loading} {...rest}>
      {children}
    </button>
  ),
  Spinner: ({ size }: any) => (
    <div data-testid="spinner" data-size={size}>
      Cargando...
    </div>
  ),
  EmptyState: ({ title, description, action }: any) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div data-testid="empty-action">{action}</div>}
    </div>
  ),
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

const mockEvaluations = [
  {
    id: 'e1',
    title: 'Prueba 1',
    subject: 'Matemáticas',
    grade: '1°',
    status: 'completed',
    created_at: '2024-03-15T12:00:00Z',
  },
  {
    id: 'e2',
    title: 'Prueba 2',
    subject: 'Lenguaje',
    grade: '2°',
    status: 'pending',
    created_at: '2024-03-16T12:00:00Z',
  },
  {
    id: 'e3',
    title: 'Prueba 3',
    subject: 'Ciencias',
    grade: '3°',
    status: 'requires_review',
    created_at: '2024-03-17T12:00:00Z',
  },
];

function setDefaultMocks() {
  mockUseEvaluations.mockReturnValue({
    data: mockEvaluations,
    isLoading: false,
  });
  mockUseDeleteEvaluation.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  });
}

async function getModule() {
  return await import('../page');
}

async function renderEvaluacionesPage() {
  const { default: EvaluacionesPage } = await getModule();
  return render(<EvaluacionesPage />);
}

describe('EvaluacionesPage (Tiza)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('muestra spinner durante la carga', async () => {
    mockUseEvaluations.mockReturnValue({
      data: null,
      isLoading: true,
    });

    await renderEvaluacionesPage();

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renderiza el título', async () => {
    await renderEvaluacionesPage();

    expect(screen.getByText('Evaluaciones')).toBeInTheDocument();
  });

  it('muestra la lista de evaluaciones', async () => {
    await renderEvaluacionesPage();

    expect(screen.getByText('Prueba 1')).toBeInTheDocument();
    expect(screen.getByText('Prueba 2')).toBeInTheDocument();
    expect(screen.getByText('Prueba 3')).toBeInTheDocument();
  });

  it('muestra el estado de cada evaluación', async () => {
    await renderEvaluacionesPage();

    const badges = screen.getAllByTestId('badge');
    const badgeTexts = badges.map((b) => b.textContent);
    expect(badgeTexts).toContain('Completada');
    expect(badgeTexts).toContain('Pendiente');
    expect(badgeTexts).toContain('Por revisar');
  });

  it('muestra materia y grado', async () => {
    await renderEvaluacionesPage();

    expect(screen.getByText('Matemáticas — 1°')).toBeInTheDocument();
    expect(screen.getByText('Lenguaje — 2°')).toBeInTheDocument();
    expect(screen.getByText('Ciencias — 3°')).toBeInTheDocument();
  });

  it('muestra empty state cuando no hay evaluaciones', async () => {
    mockUseEvaluations.mockReturnValue({
      data: [],
      isLoading: false,
    });

    await renderEvaluacionesPage();

    expect(screen.getByText('No hay evaluaciones aún')).toBeInTheDocument();
  });

  it('tiene enlace a nueva evaluación', async () => {
    await renderEvaluacionesPage();

    const newLink = screen.getByText('Nueva evaluación');
    expect(newLink.closest('a')).toHaveAttribute('href', '/dashboard/evaluaciones/nueva');
  });

  it('tiene enlaces a detalle de cada evaluación', async () => {
    await renderEvaluacionesPage();

    const detailLinks = screen.getAllByLabelText(/Ver detalle de/);
    expect(detailLinks.length).toBe(3);
  });

  it('llama a deleteEvaluation al confirmar', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseDeleteEvaluation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    await renderEvaluacionesPage();

    const deleteBtn = screen.getByLabelText('Eliminar evaluación Prueba 1');
    await userEvent.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalled();
    expect(mockMutateAsync).toHaveBeenCalledWith('e1');
  });

  it('no elimina si confirmación es cancelada', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const mockMutateAsync = vi.fn();
    mockUseDeleteEvaluation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    await renderEvaluacionesPage();

    const deleteBtn = screen.getByLabelText('Eliminar evaluación Prueba 1');
    await userEvent.click(deleteBtn);

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('tiene botón Nueva evaluación en el header', async () => {
    await renderEvaluacionesPage();

    const headerBtn = screen.getByText('Nueva evaluación');
    expect(headerBtn).toBeInTheDocument();
  });
});
