import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks must be defined before any imports ─────────────

// Auth mock
vi.mock('@/lib/auth', () => ({
  getToken: vi.fn(() => 'test-token'),
}));

// Global fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'course-1' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(), toString: () => '' }),
}));

vi.mock('@tiza/ui', () => ({
  Card: ({ children, ...props }: any) => (
    <div data-testid="card" {...props}>
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
      {description && <p data-testid="empty-description">{description}</p>}
      {icon && <div data-testid="empty-icon">{icon}</div>}
    </div>
  ),
  ErrorMessage: ({ message, onDismiss }: any) => (
    <div role="alert" data-testid="error-message">
      {message}
      {onDismiss && (
        <button aria-label="Cerrar mensaje de error" onClick={onDismiss}>
          ×
        </button>
      )}
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: () => <svg data-testid="icon-arrow-left" />,
  Users: () => <svg data-testid="icon-users" />,
  RefreshCw: () => <svg data-testid="icon-refresh" />,
}));

// ─── Fixtures ─────────────────────────────────────────────

const mockCourse = {
  id: 'course-1',
  name: '4° básico A',
  grade: '4° básico',
  subject: 'Lenguaje',
};

const mockStudents = [
  { id: 's1', course_id: 'course-1', full_name: 'Ana Martínez', student_code: 'STU-001' },
  { id: 's2', course_id: 'course-1', full_name: 'Benjamín Soto', student_code: 'STU-002' },
];

// ─── Module under test ───────────────────────────────────

async function getModule() {
  return await import('../page');
}

async function renderPage() {
  const { default: AlumnosPage } = await getModule();
  return render(<AlumnosPage />);
}

// ─── Tests ────────────────────────────────────────────────

describe('TizaAlumnosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  // ─── Loading then data ──────────────────────────────

  describe('Loading then student list', () => {
    it('muestra Spinner inicialmente y luego la tabla de estudiantes', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCourse) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStudents) });

      await renderPage();

      // Initially shows spinner
      expect(screen.getByTestId('spinner')).toBeInTheDocument();

      // After fetch completes, shows table with students
      await waitFor(() => {
        expect(screen.getByText('Ana Martínez')).toBeInTheDocument();
      });

      expect(screen.getByText('Benjamín Soto')).toBeInTheDocument();
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });

    it('muestra nombres y códigos de cada estudiante en la tabla', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCourse) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStudents) });

      await renderPage();

      await waitFor(() => {
        expect(screen.getByText('STU-001')).toBeInTheDocument();
      });
      expect(screen.getByText('STU-002')).toBeInTheDocument();
      expect(screen.getByText('Ana Martínez')).toBeInTheDocument();
      expect(screen.getByText('Benjamín Soto')).toBeInTheDocument();
    });

    it('muestra el nombre del curso en el título', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCourse) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStudents) });

      await renderPage();

      await waitFor(() => {
        expect(screen.getByText('4° básico A')).toBeInTheDocument();
      });
    });

    it('muestra el conteo de alumnos', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCourse) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStudents) });

      await renderPage();

      await waitFor(() => {
        expect(screen.getByText('2 alumnos')).toBeInTheDocument();
      });
    });
  });

  // ─── No "Agregar alumnos" button ──────────────────

  describe('Read-only — sin botones de acción', () => {
    it('NO muestra botón "Agregar alumnos"', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCourse) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStudents) });

      await renderPage();

      await waitFor(() => {
        expect(screen.getByText('Ana Martínez')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /agregar alumnos/i })).not.toBeInTheDocument();
    });

    it('NO muestra botones de eliminar (Trash2)', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCourse) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStudents) });

      await renderPage();

      await waitFor(() => {
        expect(screen.getByText('Ana Martínez')).toBeInTheDocument();
      });

      // No delete buttons should be present
      expect(screen.queryByTestId('icon-trash')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
    });

    it('NO muestra ningún botón adicional en la tabla', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCourse) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStudents) });

      await renderPage();

      await waitFor(() => {
        expect(screen.getByText('Ana Martínez')).toBeInTheDocument();
      });

      // Solo debería haber el link "Volver a cursos" y el botón "Reintentar" (no visible sin error)
      const buttons = screen.queryAllByRole('button');
      // There should be no buttons (only the link back)
      expect(buttons.length).toBe(0);
    });
  });

  // ─── Empty state ─────────────────────────────────

  describe('Empty state', () => {
    it('muestra EmptyState cuando no hay estudiantes', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCourse) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

      await renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });

      expect(screen.getByText('Sin alumnos')).toBeInTheDocument();
    });

    it('muestra "No hay alumnos registrados en este curso"', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCourse) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

      await renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('empty-description')).toHaveTextContent(
          'No hay alumnos registrados en este curso'
        );
      });
    });

    it('no muestra la tabla cuando está vacío', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCourse) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

      await renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  // ─── Read-only indicator ─────────────────────────

  describe('Read-only indicator', () => {
    it('muestra "Vista de alumnos del curso" como subtítulo', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCourse) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStudents) });

      await renderPage();

      await waitFor(() => {
        expect(screen.getByText('Vista de alumnos del curso')).toBeInTheDocument();
      });
    });

    it('muestra link "Volver a cursos"', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCourse) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStudents) });

      await renderPage();

      await waitFor(() => {
        const backLink = screen.getByRole('link', { name: /volver a cursos/i });
        expect(backLink).toBeInTheDocument();
        expect(backLink).toHaveAttribute('href', '/dashboard/cursos');
      });
    });
  });

  // ─── Error state ────────────────────────────────

  describe('Error state', () => {
    it('muestra ErrorMessage si falla la carga', async () => {
      mockFetch.mockRejectedValue(new Error('Error de conexión'));

      await renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error-message')).toHaveTextContent('Error de conexión');
    });

    it('muestra mensaje por defecto si el error no tiene mensaje', async () => {
      mockFetch.mockRejectedValue(new Error(''));

      await renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error-message')).toHaveTextContent(
        'Error al cargar los alumnos. Intenta de nuevo.'
      );
    });

    it('no muestra la tabla cuando hay error', async () => {
      mockFetch.mockRejectedValue(new Error('Error de conexión'));

      await renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('muestra empty state junto al error (students sigue siendo [])', async () => {
      mockFetch.mockRejectedValue(new Error('Error de conexión'));

      await renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });

      // EmptyState también se muestra porque students es [] por defecto
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('no muestra spinner cuando hay error', async () => {
      mockFetch.mockRejectedValue(new Error('Error de conexión'));

      await renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });

    it('muestra error cuando curso retorna !ok (HTTP error)', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStudents) });

      await renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
        expect(screen.getByTestId('error-message')).toHaveTextContent(
          'Error al cargar los datos del curso'
        );
      });
    });

    it('cierra el error al hacer dismiss', async () => {
      mockFetch.mockRejectedValue(new Error('Error de conexión'));

      await renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /cerrar mensaje de error/i }));

      await waitFor(() => {
        expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
      });
    });

    it('reintenta la carga al hacer click en Reintentar', async () => {
      // First call fails — 2 fetches go out (course + students), both fail
      mockFetch.mockRejectedValue(new Error('Error de conexión'));

      await renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });

      // Set up successful responses for retry
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCourse) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStudents) });

      // Click retry button
      const retryButton = screen.getByText(/reintentar/i);
      await userEvent.click(retryButton);

      // Error should be cleared and data loaded
      await waitFor(() => {
        expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
      });
      expect(screen.getByText('Ana Martínez')).toBeInTheDocument();
    });
  });
});
