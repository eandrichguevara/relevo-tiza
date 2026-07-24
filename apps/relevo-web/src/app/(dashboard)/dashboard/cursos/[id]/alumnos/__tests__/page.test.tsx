import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks must be defined before any imports ─────────────

const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useParams: () => ({ id: 'course-1' }),
  useSearchParams: () => ({ get: vi.fn(), toString: () => '' }),
}));

const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: (...args: any[]) => mockUseAuth(...args),
}));

const mockUseActiveTenant = vi.fn();
vi.mock('@/hooks/ActiveTenantContext', () => ({
  useActiveTenant: (...args: any[]) => mockUseActiveTenant(...args),
}));

const mockUseStudents = vi.fn();
const mockUseCourse = vi.fn();
const mockBulkCreateMutate = vi.fn();
const mockDeleteMutate = vi.fn();
const mockUseBulkCreateStudents = vi.fn();
const mockUseDeleteStudent = vi.fn();

vi.mock('@/hooks/useRelevoApi', () => ({
  useStudents: (...args: any[]) => mockUseStudents(...args),
  useCourse: (...args: any[]) => mockUseCourse(...args),
  useBulkCreateStudents: (...args: any[]) => mockUseBulkCreateStudents(...args),
  useDeleteStudent: (...args: any[]) => mockUseDeleteStudent(...args),
}));

vi.mock('@tiza/ui', () => ({
  Card: ({ children, brand, padding, ...props }: any) => (
    <div data-testid="card" data-brand={brand} data-padding={padding} {...props}>
      {children}
    </div>
  ),
  Button: ({ children, loading, disabled, onClick, type, brand, variant, ...props }: any) => (
    <button
      data-testid="button"
      disabled={disabled || loading}
      onClick={onClick}
      type={type || 'button'}
      data-brand={brand}
      data-variant={variant}
      {...props}
    >
      {loading ? 'Cargando...' : children}
    </button>
  ),
  Spinner: ({ size }: any) => (
    <div data-testid="spinner" data-size={size}>
      Cargando...
    </div>
  ),
  EmptyState: ({ title, description, icon, action }: any) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      {description && <p data-testid="empty-description">{description}</p>}
      {icon && <div data-testid="empty-icon">{icon}</div>}
      {action && <div data-testid="empty-action">{action}</div>}
    </div>
  ),
  ErrorMessage: ({ message }: any) => (
    <div role="alert" data-testid="error-message">
      {message}
    </div>
  ),
}));

vi.mock('@/components/ConfirmModal', () => ({
  default: ({
    title,
    children,
    onConfirm,
    onCancel,
    confirmLabel,
    confirmVariant,
    loading,
  }: any) => (
    <div data-testid="confirm-modal" role="dialog" aria-modal="true" aria-label={title}>
      <h3>{title}</h3>
      <div>{children}</div>
      <button
        onClick={onConfirm}
        disabled={loading}
        data-testid="confirm-yes"
        data-variant={confirmVariant}
      >
        {confirmLabel}
      </button>
      <button onClick={onCancel} data-testid="confirm-no">
        Cancelar
      </button>
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: () => <svg data-testid="icon-arrow-left" />,
  Users: () => <svg data-testid="icon-users" />,
  Trash2: () => <svg data-testid="icon-trash" />,
  Plus: () => <svg data-testid="icon-plus" />,
  RefreshCw: () => <svg data-testid="icon-refresh" />,
  X: () => <svg data-testid="icon-x" />,
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// ─── Fixtures ─────────────────────────────────────────────

const mockStudents = [
  {
    id: 's1',
    course_id: 'course-1',
    full_name: 'Ana Martínez',
    student_code: 'STU-4BA-001',
    created_at: '2026-01-15T12:00:00Z',
  },
  {
    id: 's2',
    course_id: 'course-1',
    full_name: 'Benjamín Soto',
    student_code: 'STU-4BA-002',
    created_at: '2026-01-15T12:00:00Z',
  },
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

describe('RelevoAlumnosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ accessToken: 'test-token', isAuthenticated: true });
    mockUseCourse.mockReturnValue({
      data: { id: 'course-1', name: 'Matemáticas', grade: '3° Básico' },
      isLoading: false,
      error: null,
    });
    mockBulkCreateMutate.mockReset();
    mockDeleteMutate.mockReset();
    mockUseBulkCreateStudents.mockReturnValue({
      mutateAsync: mockBulkCreateMutate,
      isPending: false,
    });
    mockUseDeleteStudent.mockReturnValue({
      mutateAsync: mockDeleteMutate,
      isPending: false,
    });
  });

  // ─── Loading state ──────────────────────────────────

  describe('Loading state', () => {
    it('muestra Spinner mientras carga', async () => {
      mockUseStudents.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      });

      await renderPage();

      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });

    it('no muestra tabla ni empty state durante carga', async () => {
      mockUseStudents.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      });

      await renderPage();

      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  // ─── Error state ────────────────────────────────────

  describe('Error state', () => {
    it('muestra ErrorMessage cuando hay error', async () => {
      mockUseStudents.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { message: 'Error de conexión' },
        refetch: vi.fn(),
      });

      await renderPage();

      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toHaveTextContent('Error al cargar los alumnos.');
    });

    it('muestra translatedMessage del error si existe', async () => {
      mockUseStudents.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { translatedMessage: 'Error específico del servidor' },
        refetch: vi.fn(),
      });

      await renderPage();

      expect(screen.getByTestId('error-message')).toHaveTextContent(
        'Error específico del servidor'
      );
    });

    it('no muestra spinner ni tabla cuando hay error', async () => {
      mockUseStudents.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { translatedMessage: 'Error' },
        refetch: vi.fn(),
      });

      await renderPage();

      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
    });
  });

  // ─── Empty state ────────────────────────────────────

  describe('Empty state', () => {
    it('muestra EmptyState con "Sin alumnos" cuando no hay estudiantes', async () => {
      mockUseStudents.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      await renderPage();

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('Sin alumnos')).toBeInTheDocument();
    });

    it('muestra descripción y botón "Agregar alumnos" en EmptyState', async () => {
      mockUseStudents.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      await renderPage();

      expect(screen.getByTestId('empty-description')).toHaveTextContent(
        'Agrega alumnos a este curso'
      );
      expect(screen.getByTestId('empty-action')).toBeInTheDocument();
      expect(screen.getByTestId('empty-action')).toHaveTextContent('Agregar alumnos');
    });
  });

  // ─── Student list ───────────────────────────────────

  describe('Student list', () => {
    it('renderiza tabla con todos los estudiantes', async () => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      await renderPage();

      const table = screen.getByRole('table', { name: /lista de alumnos/i });
      expect(table).toBeInTheDocument();

      // Names appear in both desktop and mobile views
      expect(screen.getAllByText('Ana Martínez').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Benjamín Soto').length).toBeGreaterThanOrEqual(1);
    });

    it('muestra el código de cada estudiante', async () => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      await renderPage();

      expect(screen.getAllByText('STU-4BA-001').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('STU-4BA-002').length).toBeGreaterThanOrEqual(1);
    });

    it('muestra el índice numérico de cada estudiante', async () => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      await renderPage();

      // Index numbers appear in the table footer ("2 alumnos en total") and row index
      // Check that the table contains index 1 and 2
      const table = screen.getByRole('table', { name: /lista de alumnos/i });
      expect(table.textContent).toContain('1');
      expect(table.textContent).toContain('2');
    });

    it('muestra cabeceras de la tabla', async () => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      await renderPage();

      expect(screen.getByText('Nombre')).toBeInTheDocument();
      expect(screen.getByText('Código')).toBeInTheDocument();
    });

    it('no muestra empty state cuando hay estudiantes', async () => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      await renderPage();

      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
    });
  });

  // ─── Delete student flow ────────────────────────────

  describe('Delete student', () => {
    it('abre ConfirmModal al hacer click en eliminar', async () => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      mockDeleteMutate.mockResolvedValueOnce(undefined);

      await renderPage();

      const deleteButtons = screen.getAllByRole('button', { name: /eliminar a ana martínez/i });
      await userEvent.click(deleteButtons[0]);

      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
      expect(screen.getByText('Eliminar alumno')).toBeInTheDocument();
    });

    it('llama deleteStudent.mutateAsync al confirmar', async () => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      mockDeleteMutate.mockResolvedValueOnce(undefined);

      await renderPage();

      const deleteButtons = screen.getAllByRole('button', { name: /eliminar a ana martínez/i });
      await userEvent.click(deleteButtons[0]);

      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(mockDeleteMutate).toHaveBeenCalledWith({
          studentId: 's1',
          courseId: 'course-1',
        });
      });
    });

    it('cierra el modal al cancelar la eliminación', async () => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      await renderPage();

      const deleteButtons = screen.getAllByRole('button', { name: /eliminar a benjamín soto/i });
      await userEvent.click(deleteButtons[0]);

      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();

      await userEvent.click(screen.getByTestId('confirm-no'));

      expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
    });

    it('no llama deleteStudent.mutateAsync al cancelar', async () => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      await renderPage();

      const deleteButtons = screen.getAllByRole('button', { name: /eliminar a ana martínez/i });
      await userEvent.click(deleteButtons[0]);

      await userEvent.click(screen.getByTestId('confirm-no'));

      expect(mockDeleteMutate).not.toHaveBeenCalled();
    });

    it('muestra toast de error si falla la eliminación', async () => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      mockDeleteMutate.mockRejectedValueOnce({
        translatedMessage: 'Error del servidor al eliminar.',
      });

      await renderPage();

      const deleteButtons = screen.getAllByRole('button', { name: /eliminar a ana martínez/i });
      await userEvent.click(deleteButtons[0]);

      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(screen.getByText('Error del servidor al eliminar.')).toBeInTheDocument();
      });
    });

    it('cierra el modal incluso si falla la eliminación', async () => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      mockDeleteMutate.mockRejectedValueOnce({
        detail: 'Error genérico',
      });

      await renderPage();

      const deleteButtons = screen.getAllByRole('button', { name: /eliminar a benjamín soto/i });
      await userEvent.click(deleteButtons[0]);

      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
      });
    });
  });

  // ─── Bulk add form ─────────────────────────────────

  describe('Bulk add form', () => {
    it('NO muestra el formulario de carga masiva inicialmente', async () => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      await renderPage();

      expect(screen.queryByLabelText('Nombres de alumnos (uno por línea)')).not.toBeInTheDocument();
    });

    it('muestra el formulario al hacer click en "Agregar alumnos"', async () => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      await renderPage();

      const agregarBtn = screen.getByRole('button', { name: /agregar alumnos/i });
      await userEvent.click(agregarBtn);

      expect(screen.getByLabelText('Nombres de alumnos (uno por línea)')).toBeInTheDocument();
      expect(screen.getByText('Agregar')).toBeInTheDocument();
    });

    it('oculta el formulario al hacer click en Cancelar', async () => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      await renderPage();

      await userEvent.click(screen.getByRole('button', { name: /agregar alumnos/i }));
      expect(screen.getByLabelText('Nombres de alumnos (uno por línea)')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));
      expect(screen.queryByLabelText('Nombres de alumnos (uno por línea)')).not.toBeInTheDocument();
    });

    it('oculta el formulario al hacer click en la X', async () => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      await renderPage();

      await userEvent.click(screen.getByRole('button', { name: /agregar alumnos/i }));
      expect(screen.getByLabelText('Nombres de alumnos (uno por línea)')).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Cerrar formulario'));
      expect(screen.queryByLabelText('Nombres de alumnos (uno por línea)')).not.toBeInTheDocument();
    });
  });

  // ─── Bulk submit ──────────────────────────────────

  describe('Bulk submit', () => {
    it('llama bulkCreateStudents.mutateAsync con nombres separados por línea', async () => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      mockBulkCreateMutate.mockResolvedValueOnce({ count: 2, students: [] });

      await renderPage();

      await userEvent.click(screen.getByRole('button', { name: /agregar alumnos/i }));

      const textarea = screen.getByLabelText('Nombres de alumnos (uno por línea)');
      await userEvent.type(textarea, 'Ana\nBen');

      await userEvent.click(screen.getByRole('button', { name: /^agregar$/i }));

      await waitFor(() => {
        expect(mockBulkCreateMutate).toHaveBeenCalledWith({
          courseId: 'course-1',
          names: ['Ana', 'Ben'],
        });
      });
    });

    it('cierra el formulario tras submit exitoso', async () => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      mockBulkCreateMutate.mockResolvedValueOnce({ count: 2, students: [] });

      await renderPage();

      await userEvent.click(screen.getByRole('button', { name: /agregar alumnos/i }));
      await userEvent.type(
        screen.getByLabelText('Nombres de alumnos (uno por línea)'),
        'Alumno1\nAlumno2'
      );
      await userEvent.click(screen.getByRole('button', { name: /^agregar$/i }));

      await waitFor(() => {
        expect(
          screen.queryByLabelText('Nombres de alumnos (uno por línea)')
        ).not.toBeInTheDocument();
      });
    });

    it('muestra error si no se ingresan nombres', async () => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      await renderPage();

      await userEvent.click(screen.getByRole('button', { name: /agregar alumnos/i }));

      // Botón está disabled con textarea vacío, usamos fireEvent.submit para
      // probar la validación interna del handler directamente
      const form = document.querySelector('form')!;
      fireEvent.submit(form);

      expect(screen.getByText('Ingresa al menos un nombre de alumno.')).toBeInTheDocument();
      expect(mockBulkCreateMutate).not.toHaveBeenCalled();
    });

    it('muestra error de API si falla la creación masiva', async () => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      mockBulkCreateMutate.mockRejectedValueOnce({
        translatedMessage: 'Error al crear alumnos.',
      });

      await renderPage();

      await userEvent.click(screen.getByRole('button', { name: /agregar alumnos/i }));
      await userEvent.type(screen.getByLabelText('Nombres de alumnos (uno por línea)'), 'Alumno');
      await userEvent.click(screen.getByRole('button', { name: /^agregar$/i }));

      await waitFor(() => {
        expect(screen.getByText('Error al crear alumnos.')).toBeInTheDocument();
      });
    });
  });

  // ─── Breadcrumb / Navigation ──────────────────────

  describe('Breadcrumb and navigation', () => {
    it('muestra link "Volver a cursos" con href correcto', async () => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      await renderPage();

      const backLink = screen.getByRole('link', { name: /volver a cursos/i });
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute('href', '/dashboard/cursos');
    });

    it('muestra el subtítulo "Gestión de alumnos del curso"', async () => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      await renderPage();

      expect(screen.getByText('Gestión de alumnos del curso')).toBeInTheDocument();
    });
  });

  // ─── useCourse states (Inquisitor Objeción #4) ────

  describe('useCourse states', () => {
    it('muestra "Cargando..." cuando useCourse está loading', async () => {
      mockUseCourse.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });
      mockUseStudents.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      await renderPage();

      expect(screen.getByText('Cargando...')).toBeDefined();
    });

    it('maneja useCourse con error y muestra el título fallback', async () => {
      mockUseCourse.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { message: 'Curso no encontrado' },
      });
      mockUseStudents.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      await renderPage();

      // Debería mostrar el fallback "Cargando..." o similar
      expect(screen.getByText('Cargando...')).toBeDefined();
    });

    it('muestra el nombre del curso correctamente cuando useCourse tiene data', async () => {
      mockUseCourse.mockReturnValue({
        data: { id: 'course-1', name: 'Matemáticas', grade: '3° Básico' },
        isLoading: false,
        error: null,
      });
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
      });

      await renderPage();

      expect(screen.getByText('Matemáticas — 3° Básico')).toBeDefined();
    });
  });

  // ─── Bulk add edge cases (Inquisitor Objeción #1) ─

  describe('Bulk add edge cases', () => {
    beforeEach(() => {
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
      });
    });

    it('filtra nombres con solo espacios en blanco', async () => {
      await renderPage();

      // Abrir bulk form
      const addButton = screen.getByText('Agregar alumnos');
      fireEvent.click(addButton);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '   \n   \n   ' } });

      // El botón está disabled cuando el input es solo whitespace,
      // así que usamos fireEvent.submit directamente (mismo patrón que
      // el test existente "muestra error si no se ingresan nombres")
      const form = document.querySelector('form')!;
      fireEvent.submit(form);

      // Debería mostrar error porque después de filtrar no quedan nombres
      expect(screen.getByText(/Ingresa al menos un nombre/i)).toBeDefined();
      // NO debería llamar al mutate
      expect(mockBulkCreateMutate).not.toHaveBeenCalled();
    });

    it('envía nombres con caracteres especiales y Unicode correctamente', async () => {
      await renderPage();

      fireEvent.click(screen.getByText('Agregar alumnos'));

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'María José\nBenjamín\nÑoño' } });

      fireEvent.click(screen.getByText('Agregar'));

      await waitFor(() => {
        expect(mockBulkCreateMutate).toHaveBeenCalledWith({
          courseId: 'course-1',
          names: ['María José', 'Benjamín', 'Ñoño'],
        });
      });
    });

    it('envía nombres duplicados sin deduplicar (responsabilidad del backend)', async () => {
      await renderPage();

      fireEvent.click(screen.getByText('Agregar alumnos'));

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Ana Martínez\nAna Martínez' } });

      fireEvent.click(screen.getByText('Agregar'));

      await waitFor(() => {
        expect(mockBulkCreateMutate).toHaveBeenCalledWith({
          courseId: 'course-1',
          names: ['Ana Martínez', 'Ana Martínez'],
        });
      });
    });

    it('maneja nombres extremadamente largos (>500 caracteres)', async () => {
      await renderPage();

      fireEvent.click(screen.getByText('Agregar alumnos'));

      const longName = 'A'.repeat(500);
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: longName } });

      fireEvent.click(screen.getByText('Agregar'));

      await waitFor(() => {
        expect(mockBulkCreateMutate).toHaveBeenCalledWith({
          courseId: 'course-1',
          names: [longName],
        });
      });
    });

    it('maneja 100+ nombres en un solo bulk', async () => {
      await renderPage();

      fireEvent.click(screen.getByText('Agregar alumnos'));

      const names = Array.from({ length: 100 }, (_, i) => `Estudiante ${i + 1}`);
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: names.join('\n') } });

      fireEvent.click(screen.getByText('Agregar'));

      await waitFor(() => {
        expect(mockBulkCreateMutate).toHaveBeenCalledWith({
          courseId: 'course-1',
          names: names,
        });
      });
    });
  });

  // ─── Toast behavior (Inquisitor Objeción #6) ──────

  describe('Toast behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      mockUseStudents.mockReturnValue({
        data: mockStudents,
        isLoading: false,
        error: null,
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('desaparece el toast después de 4 segundos tras eliminación exitosa', async () => {
      // Simular mutación de delete exitosa
      mockDeleteMutate.mockResolvedValue({ message: 'Estudiante eliminado' });

      await renderPage();

      // Hacer click en eliminar del primer estudiante
      const deleteButtons = screen.getAllByRole('button', { name: /Eliminar/i });
      fireEvent.click(deleteButtons[0]);

      // Confirmar en el modal
      const confirmButton = screen.getByTestId('confirm-yes');
      fireEvent.click(confirmButton);

      // Con fake timers, waitFor no puede usar setTimeout para polling.
      // advanceTimersByTimeAsync(0) dentro de act para flush de microtasks sin avanzar timers
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Verificar que el toast aparece (la mutación resolvió y showToast se ejecutó)
      expect(screen.getByText(/eliminado/i)).toBeDefined();

      // Avanzar 4 segundos para que el setTimeout del toast se dispare
      // y React flushée el estado batch (setToast(null)) dentro de act
      act(() => {
        vi.advanceTimersByTime(4000);
      });

      // Verificar que el toast desaparece
      expect(screen.queryByText(/eliminado/i)).toBeNull();
    });
  });
});
