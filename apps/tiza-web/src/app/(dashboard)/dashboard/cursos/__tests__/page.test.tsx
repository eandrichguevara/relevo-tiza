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

const mockUseCourses = vi.fn();
const mockUseDeleteCourse = vi.fn();
vi.mock('@/hooks/useApi', () => ({
  useCourses: (...args: any[]) => mockUseCourses(...args),
  useDeleteCourse: (...args: any[]) => mockUseDeleteCourse(...args),
}));

vi.mock('@tiza/ui', () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  Button: ({ children, variant, size, 'aria-label': ariaLabel, ...rest }: any) => (
    <button aria-label={ariaLabel} {...rest}>
      {children}
    </button>
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
}));

const mockCourses = [
  {
    id: 'c1',
    name: '1° A',
    grade: '1°',
    subject: 'Matemáticas',
    student_count: 30,
    created_at: '2024-01-01',
  },
  {
    id: 'c2',
    name: '2° B',
    grade: '2°',
    subject: 'Lenguaje',
    student_count: 28,
    created_at: '2024-01-02',
  },
];

function setDefaultMocks() {
  mockUseCourses.mockReturnValue({
    data: mockCourses,
    isLoading: false,
    error: null,
  });
  mockUseDeleteCourse.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  });
}

async function getModule() {
  return await import('../page');
}

async function renderCursosPage() {
  const { default: CursosPage } = await getModule();
  return render(<CursosPage />);
}

describe('CursosPage (Tiza)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultMocks();
    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('muestra spinner durante la carga', async () => {
    mockUseCourses.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    await renderCursosPage();

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renderiza el título y subtítulo', async () => {
    await renderCursosPage();

    expect(screen.getByText('Mis Cursos')).toBeInTheDocument();
    expect(screen.getByText('Gestiona tus cursos y alumnos')).toBeInTheDocument();
  });

  it('muestra lista de cursos', async () => {
    await renderCursosPage();

    expect(screen.getByText(/1° A/)).toBeInTheDocument();
    expect(screen.getByText(/2° B/)).toBeInTheDocument();
    expect(screen.getByText('Matemáticas · 30 alumnos')).toBeInTheDocument();
    expect(screen.getByText('Lenguaje · 28 alumnos')).toBeInTheDocument();
  });

  it('muestra empty state cuando no hay cursos', async () => {
    mockUseCourses.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    await renderCursosPage();

    expect(screen.getByText('No tienes cursos aún')).toBeInTheDocument();
  });

  it('tiene enlaces a detalle de alumnos y stats', async () => {
    await renderCursosPage();

    const alumnosLinks = screen.getAllByLabelText(/Alumnos de/);
    expect(alumnosLinks.length).toBe(2);

    const statsLinks = screen.getAllByLabelText(/Estadísticas de/);
    expect(statsLinks.length).toBe(2);
  });

  it('tiene botones de eliminar para cada curso', async () => {
    await renderCursosPage();

    const deleteButtons = screen.getAllByLabelText(/Eliminar/);
    expect(deleteButtons.length).toBe(2);
  });

  it('llama a deleteCourse al confirmar eliminación', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseDeleteCourse.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    await renderCursosPage();

    const deleteBtn = screen.getByLabelText('Eliminar 1° A');
    await userEvent.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalled();
    expect(mockMutateAsync).toHaveBeenCalledWith('c1');
  });

  it('no elimina si confirmación es cancelada', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const mockMutateAsync = vi.fn();
    mockUseDeleteCourse.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    await renderCursosPage();

    const deleteBtn = screen.getByLabelText('Eliminar 1° A');
    await userEvent.click(deleteBtn);

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('muestra error banner cuando hay error de carga', async () => {
    mockUseCourses.mockReturnValue({
      data: null,
      isLoading: false,
      error: { translatedMessage: 'Error de conexión' },
    });

    await renderCursosPage();

    expect(screen.getByText('Error de conexión')).toBeInTheDocument();
  });

  it('cierra el error local al hacer clic en cerrar, pero el error del servidor persiste', async () => {
    mockUseCourses.mockReturnValue({
      data: null,
      isLoading: false,
      error: { translatedMessage: 'Error de conexión' },
    });

    await renderCursosPage();

    expect(screen.getByText('Error de conexión')).toBeInTheDocument();
    const closeBtn = screen.getByLabelText('Cerrar mensaje de error');
    await userEvent.click(closeBtn);

    // The coursesError from useCourses persists, so the banner stays
    expect(screen.getByText('Error de conexión')).toBeInTheDocument();
  });

  it('muestra error local cuando delete falla', async () => {
    mockUseCourses.mockReturnValue({
      data: mockCourses,
      isLoading: false,
      error: null,
    });

    const mockMutateAsync = vi.fn().mockRejectedValue({
      translatedMessage: 'Error del servidor al eliminar',
    });
    mockUseDeleteCourse.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    await renderCursosPage();

    const deleteBtn = screen.getByLabelText('Eliminar 1° A');
    await userEvent.click(deleteBtn);

    // Wait for the error to show
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('Error del servidor al eliminar')).toBeInTheDocument();
  });

  it('muestra cursos con el formato correcto nombre — grado', async () => {
    await renderCursosPage();

    expect(screen.getByText('1° A — 1°')).toBeInTheDocument();
    expect(screen.getByText('2° B — 2°')).toBeInTheDocument();
  });
});
