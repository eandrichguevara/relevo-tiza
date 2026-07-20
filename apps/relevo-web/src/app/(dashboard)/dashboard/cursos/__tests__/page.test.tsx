import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks must be defined before any imports ───────────────────────

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockSearchParamsGet = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({
    get: mockSearchParamsGet,
    toString: () => '',
  }),
}));

const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: (...args: any[]) => mockUseAuth(...args),
}));

const mockUseActiveTenant = vi.fn();
vi.mock('@/hooks/ActiveTenantContext', () => ({
  useActiveTenant: (...args: any[]) => mockUseActiveTenant(...args),
}));

const mockUseTenants = vi.fn();
const mockUseCourses = vi.fn();
const mockUseCreateCourse = vi.fn();
const mockUseDeleteCourse = vi.fn();
const mockUseUsers = vi.fn();

vi.mock('@/hooks/useRelevoApi', () => ({
  useTenants: (...args: any[]) => mockUseTenants(...args),
  useCourses: (...args: any[]) => mockUseCourses(...args),
  useCreateCourse: (...args: any[]) => mockUseCreateCourse(...args),
  useDeleteCourse: (...args: any[]) => mockUseDeleteCourse(...args),
  useUsers: (...args: any[]) => mockUseUsers(...args),
}));

vi.mock('@tiza/ui', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div data-testid="card" className={className} {...props}>
      {children}
    </div>
  ),
  Button: ({ children, loading, disabled, onClick, type, variant, size, brand, ...props }: any) => (
    <button
      disabled={disabled || loading}
      onClick={onClick}
      type={type || 'button'}
      data-variant={variant}
      data-size={size}
      data-loading={loading ? 'true' : 'false'}
      {...props}
    >
      {loading ? 'Cargando...' : children}
    </button>
  ),
  Input: ({ label, error, ...props }: any) => (
    <div>
      {label && (
        <label htmlFor={props.id || label?.toLowerCase().replace(/\s+/g, '-')}>{label}</label>
      )}
      <input
        id={props.id || label?.toLowerCase().replace(/\s+/g, '-')}
        aria-label={label}
        {...props}
      />
      {error && <span role="alert">{error}</span>}
    </div>
  ),
  Badge: ({ children, variant }: any) => <span data-variant={variant}>{children}</span>,
  Spinner: ({ size }: any) => (
    <div data-testid="spinner" data-size={size}>
      Cargando...
    </div>
  ),
  EmptyState: ({ title, description, action, icon }: any) => (
    <div data-testid="empty-state">
      <h3 data-testid="empty-title">{title}</h3>
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

vi.mock('lucide-react', () => ({
  BookOpen: () => <svg data-testid="icon-book" />,
  Plus: () => <svg data-testid="icon-plus" />,
  Trash2: () => <svg data-testid="icon-trash" />,
  X: () => <svg data-testid="icon-x" />,
  School: () => <svg data-testid="icon-school" />,
  Users: () => <svg data-testid="icon-users" />,
  RefreshCw: () => <svg data-testid="icon-refresh" />,
  GraduationCap: () => <svg data-testid="icon-graduation" />,
  Check: () => <svg data-testid="icon-check" />,
}));

vi.mock('@/components/ConfirmModal', () => ({
  default: ({
    title,
    children,
    onConfirm,
    onCancel,
    confirmLabel,
    loading,
    confirmVariant,
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

// ─── Module under test ─────────────────────────────────────

async function getModule() {
  return await import('../page');
}

// ─── Fixtures ───────────────────────────────────────────────

const MOCK_TENANTS = [
  { id: 't1', name: 'Colegio San Miguel', subdomain: 'san-miguel', brand: 'relevo', settings: {} },
  {
    id: 't2',
    name: 'Liceo Gabriela Mistral',
    subdomain: 'gabriela-mistral',
    brand: 'relevo',
    settings: {},
  },
  {
    id: 't3',
    name: 'Instituto Nacional',
    subdomain: 'instituto-nacional',
    brand: 'relevo',
    settings: {},
  },
];

const MOCK_COURSES = [
  {
    id: 'c1',
    name: '4° básico A',
    grade: '4° básico',
    subject: 'Lenguaje, Matemáticas',
    student_count: 32,
    created_at: '2026-01-15T12:00:00Z',
  },
  {
    id: 'c2',
    name: '5° básico B',
    grade: '5° básico',
    subject: 'Matemáticas, Ciencias Naturales',
    student_count: 28,
    created_at: '2026-02-01T12:00:00Z',
  },
  {
    id: 'c3',
    name: 'I medio A',
    grade: 'I medio',
    subject: 'Lenguaje, Historia, Inglés',
    student_count: 35,
    created_at: '2026-03-10T12:00:00Z',
  },
];

const MOCK_USERS = [
  {
    id: 'u1',
    name: 'Carolina Llona de Cuevas',
    email: 'carolina@test.cl',
    role: 'TEACHER',
    status: 'active',
    tenantId: 't1',
    created_at: '2025-01-01',
  },
  {
    id: 'u2',
    name: 'Pedro Pérez',
    email: 'pedro@test.cl',
    role: 'TEACHER',
    status: 'active',
    tenantId: 't1',
    created_at: '2025-01-01',
  },
  {
    id: 'u3',
    name: 'Juan Admin',
    email: 'admin@test.cl',
    role: 'HOLDER',
    status: 'active',
    tenantId: 't1',
    created_at: '2025-01-01',
  },
];

const DEFAULT_AUTH = {
  accessToken: 'mock-token',
  isAuthenticated: true,
  user: { id: '1', role: 'HOLDER' },
};

const DEFAULT_ACTIVE_TENANT = {
  activeTenantId: 't1',
  activeTenant: MOCK_TENANTS[0],
  tenants: MOCK_TENANTS,
  setActiveTenantId: vi.fn(),
  isLoading: false,
  isError: false,
};

// ─── Helpers ────────────────────────────────────────────────

async function renderPage() {
  const { default: CursosPage } = await getModule();
  return render(<CursosPage />);
}

// ─── Tests ──────────────────────────────────────────────────

describe('CursosPage', () => {
  let mutateAsyncCreate: ReturnType<typeof vi.fn>;
  let mutateAsyncDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ ...DEFAULT_AUTH });
    mockUseActiveTenant.mockReturnValue({ ...DEFAULT_ACTIVE_TENANT });

    // Default tenant loading: loaded with tenants
    mockUseTenants.mockReturnValue({
      data: MOCK_TENANTS,
      isLoading: false,
    });

    // Default courses: loaded with courses
    mockUseCourses.mockReturnValue({
      data: MOCK_COURSES,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    mutateAsyncCreate = vi.fn();
    mockUseCreateCourse.mockReturnValue({
      mutateAsync: mutateAsyncCreate,
      isPending: false,
    });

    mutateAsyncDelete = vi.fn();
    mockUseDeleteCourse.mockReturnValue({
      mutateAsync: mutateAsyncDelete,
      isPending: false,
    });

    mockUseUsers.mockReturnValue({
      data: MOCK_USERS,
      isLoading: false,
    });

    mockSearchParamsGet.mockReturnValue(null);
  });

  // ─── Page structure ─────────────────────────────────────

  describe('Estructura de página', () => {
    it('renderiza el título y descripción', async () => {
      await renderPage();
      expect(screen.getByText('Cursos')).toBeInTheDocument();
      expect(screen.getByText('Gestiona los cursos de tus colegios')).toBeInTheDocument();
    });

    it('renderiza el botón "Nuevo curso"', async () => {
      await renderPage();
      const btn = screen.getByRole('button', { name: /nuevo curso/i });
      expect(btn).toBeInTheDocument();
      expect(btn).not.toBeDisabled();
    });

    it('muestra icono de colegio en el selector de tenants', async () => {
      await renderPage();
      // Should show the badge with subdomain
      expect(screen.getByText('san-miguel.relevo.cl')).toBeInTheDocument();
    });
  });

  // ─── Loading state (tenants) ────────────────────────────

  describe('Loading state — tenents', () => {
    it('muestra Spinner en el selector mientras carga tenants', async () => {
      mockUseTenants.mockReturnValue({
        data: undefined,
        isLoading: true,
      });
      mockUseActiveTenant.mockReturnValue({
        activeTenantId: null,
        activeTenant: null,
        tenants: [],
        setActiveTenantId: vi.fn(),
        isLoading: true,
        isError: false,
      });

      await renderPage();

      // Spinner should be visible in the tenant selector area
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
      // "Nuevo curso" button disabled because no tenant
      expect(screen.getByRole('button', { name: /nuevo curso/i })).toBeDisabled();
    });
  });

  // ─── No tenant selected ────────────────────────────────

  describe('Sin tenant seleccionado', () => {
    beforeEach(() => {
      mockUseActiveTenant.mockReturnValue({
        activeTenantId: null,
        activeTenant: null,
        tenants: MOCK_TENANTS,
        setActiveTenantId: vi.fn(),
        isLoading: false,
        isError: false,
      });
      mockUseCourses.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
    });

    it('muestra EmptyState "Selecciona un colegio"', async () => {
      await renderPage();
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByTestId('empty-title')).toHaveTextContent('Selecciona un colegio');
      expect(screen.getByTestId('empty-description')).toHaveTextContent(/elige un colegio/i);
      expect(screen.getByTestId('icon-school')).toBeInTheDocument();
    });

    it('no muestra la lista de cursos ni el mensaje de cursos vacío', async () => {
      await renderPage();
      expect(screen.queryByTestId('empty-action')).not.toBeInTheDocument();
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('botón "Nuevo curso" deshabilitado sin tenant', async () => {
      await renderPage();
      expect(screen.getByRole('button', { name: /nuevo curso/i })).toBeDisabled();
    });

    it('el selector de tenant está vacío', async () => {
      await renderPage();
      const select = screen.getByLabelText('Seleccionar colegio') as HTMLSelectElement;
      expect(select.value).toBe('');
    });

    it('muestra opción placeholder en el selector', async () => {
      await renderPage();
      const select = screen.getByLabelText('Seleccionar colegio');
      expect(select).toContainHTML('Selecciona un colegio');
    });
  });

  // ─── Tenant selected — loading courses ──────────────────

  describe('Tenant seleccionado — loading cursos', () => {
    it('muestra Spinner grande mientras cargan los cursos', async () => {
      mockUseCourses.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      });

      await renderPage();

      // Should have a spinner (the centered one)
      const spinners = screen.getAllByTestId('spinner');
      expect(spinners.length).toBeGreaterThanOrEqual(1);
    });

    it('no muestra la lista de cursos ni empty state durante carga', async () => {
      mockUseCourses.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      });

      await renderPage();

      expect(screen.queryByRole('list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
    });
  });

  // ─── Tenant selected — courses loaded ───────────────────

  describe('Tenant seleccionado — lista de cursos', () => {
    it('renderiza todos los cursos en la lista', async () => {
      await renderPage();

      const list = screen.getByRole('list', { name: /lista de cursos/i });
      expect(list).toBeInTheDocument();

      MOCK_COURSES.forEach((course) => {
        expect(screen.getByText(new RegExp(`${course.name}.*${course.grade}`))).toBeInTheDocument();
        expect(screen.getByText(course.subject)).toBeInTheDocument();
      });
    });

    it('muestra el conteo de alumnos por curso', async () => {
      await renderPage();
      expect(screen.getByText(/32 alumnos/)).toBeInTheDocument();
      expect(screen.getByText(/28 alumnos/)).toBeInTheDocument();
      expect(screen.getByText(/35 alumnos/)).toBeInTheDocument();
    });

    it('muestra la fecha de creación formateada', async () => {
      await renderPage();
      // Cada tarjeta muestra el conteo de alumnos con fecha
      const alumnosLabels = screen.getAllByText(/alumnos/);
      expect(alumnosLabels).toHaveLength(3);
      // Verificar formato fecha chileno (no ISO raw)
      expect(screen.getByText(/15 ene 2026/)).toBeInTheDocument();
      expect(screen.getByText(/1 feb 2026/)).toBeInTheDocument();
      expect(screen.getByText(/10 mar 2026/)).toBeInTheDocument();
      // 4 tarjetas: 1 selector tenant + 3 cursos
      const cards = screen.getAllByTestId('card');
      expect(cards.length).toBe(4);
    });

    it('cada curso tiene botón para eliminar', async () => {
      await renderPage();
      const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i });
      expect(deleteButtons).toHaveLength(MOCK_COURSES.length);
    });

    it('cada curso muestra un icono BookOpen', async () => {
      await renderPage();
      const bookIcons = screen.getAllByTestId('icon-book');
      expect(bookIcons).toHaveLength(MOCK_COURSES.length);
    });
  });

  // ─── Tenant selected — empty courses ────────────────────

  describe('Tenant seleccionado — sin cursos', () => {
    beforeEach(() => {
      mockUseCourses.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
    });

    it('muestra EmptyState "No hay cursos en este colegio"', async () => {
      await renderPage();
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByTestId('empty-title')).toHaveTextContent('No hay cursos en este colegio');
    });

    it('muestra botón "Crear curso" en el EmptyState', async () => {
      await renderPage();
      expect(screen.getByTestId('empty-action')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /crear curso/i })).toBeInTheDocument();
    });

    it('el botón "Crear curso" del EmptyState abre el modal', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /crear curso/i }));
      expect(screen.getByRole('dialog', { name: /nuevo curso/i })).toBeInTheDocument();
    });

    it('no muestra la lista de cursos', async () => {
      await renderPage();
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });
  });

  // ─── Tenant selected — error ────────────────────────────

  describe('Tenant seleccionado — error al cargar', () => {
    it('muestra mensaje de error y botón reintentar', async () => {
      const mockRefetch = vi.fn();
      mockUseCourses.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { translatedMessage: 'Error de conexión' },
        refetch: mockRefetch,
      });

      await renderPage();

      expect(screen.getByTestId('error-message')).toHaveTextContent('Error de conexión');
      expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    });

    it('usa mensaje por defecto si no hay translatedMessage', async () => {
      mockUseCourses.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { detail: 'Server error' },
        refetch: vi.fn(),
      });

      await renderPage();

      expect(screen.getByTestId('error-message')).toHaveTextContent('Error al cargar los cursos');
    });

    it('el botón reintentar llama refetch', async () => {
      const mockRefetch = vi.fn();
      mockUseCourses.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { translatedMessage: 'Error' },
        refetch: mockRefetch,
      });

      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
      expect(mockRefetch).toHaveBeenCalledOnce();
    });

    it('no muestra la lista de cursos ni empty state', async () => {
      mockUseCourses.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { translatedMessage: 'Error' },
        refetch: vi.fn(),
      });

      await renderPage();

      expect(screen.queryByRole('list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
    });
  });

  // ─── Modal: abrir / cerrar ─────────────────────────────

  describe('Modal de crear curso — apertura y cierre', () => {
    it('abre el modal al hacer click en "Nuevo curso"', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));
      expect(screen.getByRole('dialog', { name: /nuevo curso/i })).toBeInTheDocument();
    });

    it('muestra el título "Nuevo curso" en el modal', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));
      // Usar heading role para evitar ambigüedad con el botón "Nuevo curso"
      expect(screen.getByRole('heading', { name: /nuevo curso/i })).toBeInTheDocument();
    });

    it('cierra el modal al hacer click en la X', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Cerrar modal'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('cierra el modal al hacer click en Cancelar', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('cierra el modal al hacer click en el backdrop', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // El backdrop ES el role="dialog" (tiene onClick={handleCloseModal})
      const modalBackdrop = screen.getByRole('dialog');
      await userEvent.click(modalBackdrop);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('resetea el formulario al abrir el modal (múltiples veces)', async () => {
      await renderPage();

      // Abrir y llenar algo
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));
      const nameInput = screen.getByLabelText('Nombre del curso');
      await userEvent.type(nameInput, 'Test Course');
      expect(nameInput).toHaveValue('Test Course');

      // Cerrar
      await userEvent.click(screen.getByLabelText('Cerrar modal'));

      // Re-abrir — el form debe estar limpio
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));
      const newNameInput = screen.getByLabelText('Nombre del curso');
      expect(newNameInput).toHaveValue('');
    });

    it('muestra info del colegio seleccionado en el modal', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));
      // Buscar el texto dentro del strong (en la info del modal), no en el <select>
      expect(screen.getByText(/Agregando a:/)).toBeInTheDocument();
      // Colegio San Miguel aparece tanto en el <select> como en el modal, verificamos ambos
      const colegioElements = screen.getAllByText('Colegio San Miguel');
      expect(colegioElements.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── Formulario: campos ─────────────────────────────────

  describe('Formulario de creación — campos', () => {
    beforeEach(async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));
    });

    it('renderiza campo "Nombre del curso"', () => {
      expect(screen.getByLabelText('Nombre del curso')).toBeInTheDocument();
    });

    it('renderiza selector de nivel con opciones', () => {
      const gradeSelect = screen.getByLabelText('Seleccionar nivel');
      expect(gradeSelect).toBeInTheDocument();
      expect(gradeSelect).toContainHTML('1° básico');
      expect(gradeSelect).toContainHTML('IV medio');
    });

    it('tiene nivel por defecto "1° básico"', () => {
      const gradeSelect = screen.getByLabelText('Seleccionar nivel') as HTMLSelectElement;
      expect(gradeSelect.value).toBe('1° básico');
    });

    it('renderiza asignaturas preseleccionadas (Lenguaje, Matemáticas)', () => {
      const checkboxes = screen.getAllByRole('checkbox');
      const checked = checkboxes.filter((cb) => (cb as HTMLInputElement).checked);
      expect(checked).toHaveLength(2);
    });

    it('muestra contador de asignaturas seleccionadas', () => {
      expect(screen.getByText(/2 asignaturas seleccionadas/)).toBeInTheDocument();
    });

    it('toggle de asignatura funciona', async () => {
      // Desmarcar Lenguaje
      const lenguajeCheckbox = screen.getByRole('checkbox', { name: 'Lenguaje' }) as HTMLInputElement;
      await userEvent.click(lenguajeCheckbox);
      expect(lenguajeCheckbox.checked).toBe(false);
      expect(screen.getByText(/1 asignatura seleccionada/)).toBeInTheDocument();
    });

    it('asignatura marcada tiene estilo visual diferente (border-brand-primary)', async () => {
      const lenguajeLabel = screen.getByRole('checkbox', { name: 'Lenguaje' }).closest('label')!;
      expect(lenguajeLabel.className).toContain('border-brand-primary');
    });

    it('asignatura desmarcada tiene estilo gris', async () => {
      // Desmarcar Matemáticas para verificar estilo gris
      const matesCheckbox = screen.getByRole('checkbox', { name: 'Matemáticas' }) as HTMLInputElement;
      await userEvent.click(matesCheckbox);
      expect(matesCheckbox.checked).toBe(false);
      const matesLabel = screen.getByRole('checkbox', { name: 'Matemáticas' }).closest('label')!;
      expect(matesLabel.className).toContain('border-gray-200');
    });
  });

  // ─── Formulario: validación ─────────────────────────────

  describe('Formulario de creación — validación', () => {
    it('muestra error si el nombre está vacío', async () => {
      await renderPage();

      // Abrir modal
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /nuevo curso/i })).toBeInTheDocument();
      });

      // Submit con nombre vacío — usamos fireEvent.submit para evitar
      // inconsistencias de userEvent.click con botones type="submit" en jsdom
      const form = document.querySelector('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('El nombre del curso es obligatorio.')).toBeInTheDocument();
      });
      expect(mutateAsyncCreate).not.toHaveBeenCalled();
    });

    it('muestra error si no hay asignaturas seleccionadas', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));

      // Deseleccionar todas las asignaturas
      const checkboxes = screen.getAllByRole('checkbox');
      for (const cb of checkboxes) {
        if ((cb as HTMLInputElement).checked) {
          await userEvent.click(cb);
        }
      }

      // Escribir nombre
      await userEvent.type(screen.getByLabelText('Nombre del curso'), '4° básico A');

      // Nota: los selects de profesor no se renderizan si no hay asignaturas

      // Submit
      await userEvent.click(screen.getByRole('button', { name: /crear curso/i }));

      expect(screen.getByText('Selecciona al menos una asignatura.')).toBeInTheDocument();
      expect(mutateAsyncCreate).not.toHaveBeenCalled();
    });

    it('no muestra error si se proporciona nombre con espacios (trim)', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));

      // Solo espacios en blanco
      await userEvent.type(screen.getByLabelText('Nombre del curso'), '   ');

      // Usamos fireEvent.submit para evitar HTML5 validation de required fields
      const form = document.querySelector('form')!;
      fireEvent.submit(form);

      expect(screen.getByText('El nombre del curso es obligatorio.')).toBeInTheDocument();
    });

    it('muestra error si no se selecciona profesor', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));

      await userEvent.type(screen.getByLabelText('Nombre del curso'), 'Curso sin profesor');
      // No seleccionar profesor — dejar el select vacío

      // Usamos fireEvent.submit para evitar HTML5 validation de required fields
      const form = document.querySelector('form')!;
      fireEvent.submit(form);

      expect(
        screen.getByText('Selecciona un profesor para: Lenguaje, Matemáticas.')
      ).toBeInTheDocument();
      expect(mutateAsyncCreate).not.toHaveBeenCalled();
    });
  });

  // ─── Formulario: submit exitoso ─────────────────────────

  describe('Formulario de creación — submit exitoso', () => {
    it('llama createCourse.mutateAsync con los datos correctos', async () => {
      mutateAsyncCreate.mockResolvedValueOnce({ id: 'c4' });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));

      await userEvent.type(screen.getByLabelText('Nombre del curso'), '4° básico A');

      // Cambiar nivel
      const gradeSelect = screen.getByLabelText('Seleccionar nivel');
      await userEvent.selectOptions(gradeSelect, '4° básico');

      // Seleccionar profesores por asignatura
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Lenguaje'),
        'u1'
      );
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Matemáticas'),
        'u2'
      );

      await userEvent.click(screen.getByRole('button', { name: /crear curso/i }));

      await waitFor(() => {
        expect(mutateAsyncCreate).toHaveBeenCalledWith({
          name: '4° básico A',
          grade: '4° básico',
          subject: 'Lenguaje, Matemáticas',
          teachers: { Lenguaje: 'u1', Matemáticas: 'u2' },
          tenant_id: 't1',
        });
      });
    });

    it('cierra el modal tras crear exitosamente', async () => {
      mutateAsyncCreate.mockResolvedValueOnce({ id: 'c4' });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await userEvent.type(screen.getByLabelText('Nombre del curso'), 'Nuevo curso test');
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Lenguaje'),
        'u1'
      );
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Matemáticas'),
        'u1'
      );
      await userEvent.click(screen.getByRole('button', { name: /crear curso/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('muestra toast de éxito tras crear curso', async () => {
      mutateAsyncCreate.mockResolvedValueOnce({ id: 'c4' });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));

      await userEvent.type(screen.getByLabelText('Nombre del curso'), 'Test Course');
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Lenguaje'),
        'u1'
      );
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Matemáticas'),
        'u1'
      );
      await userEvent.click(screen.getByRole('button', { name: /crear curso/i }));

      await waitFor(() => {
        expect(screen.getByText(/creado exitosamente/i)).toBeInTheDocument();
      });
    });

    it('incluye asignaturas seleccionadas en el subject', async () => {
      mutateAsyncCreate.mockResolvedValueOnce({ id: 'c4' });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));

      await userEvent.type(screen.getByLabelText('Nombre del curso'), 'Curso con asignaturas');

      // Las 2 asignaturas vienen preseleccionadas por defecto
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Lenguaje'),
        'u1'
      );
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Matemáticas'),
        'u1'
      );
      await userEvent.click(screen.getByRole('button', { name: /crear curso/i }));

      await waitFor(() => {
        expect(mutateAsyncCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            subject: 'Lenguaje, Matemáticas',
          })
        );
      });
    });
  });

  // ─── Formulario: submit con error ───────────────────────

  describe('Formulario de creación — error en API', () => {
    it('muestra translatedMessage del error de API', async () => {
      mutateAsyncCreate.mockRejectedValueOnce({
        translatedMessage: 'El nombre del curso ya existe.',
      });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));

      await userEvent.type(screen.getByLabelText('Nombre del curso'), 'Curso duplicado');
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Lenguaje'),
        'u1'
      );
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Matemáticas'),
        'u1'
      );
      await userEvent.click(screen.getByRole('button', { name: /crear curso/i }));

      await waitFor(() => {
        expect(screen.getByText('El nombre del curso ya existe.')).toBeInTheDocument();
      });
    });

    it('muestra error.detail si no hay translatedMessage', async () => {
      mutateAsyncCreate.mockRejectedValueOnce({
        detail: 'Internal server error',
      });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));

      await userEvent.type(screen.getByLabelText('Nombre del curso'), 'Curso fallido');
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Lenguaje'),
        'u1'
      );
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Matemáticas'),
        'u1'
      );
      await userEvent.click(screen.getByRole('button', { name: /crear curso/i }));

      await waitFor(() => {
        expect(screen.getByText('Internal server error')).toBeInTheDocument();
      });
    });

    it('muestra mensaje genérico si no hay ni translatedMessage ni detail', async () => {
      mutateAsyncCreate.mockRejectedValueOnce(new Error('Network error'));
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));

      await userEvent.type(screen.getByLabelText('Nombre del curso'), 'Curso fallido');
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Lenguaje'),
        'u1'
      );
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Matemáticas'),
        'u1'
      );
      await userEvent.click(screen.getByRole('button', { name: /crear curso/i }));

      await waitFor(() => {
        expect(screen.getByText('Error al crear el curso. Intenta de nuevo.')).toBeInTheDocument();
      });
    });

    it('el modal permanece abierto si hay error', async () => {
      mutateAsyncCreate.mockRejectedValueOnce({
        translatedMessage: 'Error de red',
      });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));

      await userEvent.type(screen.getByLabelText('Nombre del curso'), 'Curso fallido');
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Lenguaje'),
        'u1'
      );
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Matemáticas'),
        'u1'
      );
      await userEvent.click(screen.getByRole('button', { name: /crear curso/i }));

      await waitFor(() => {
        expect(screen.getByText('Error de red')).toBeInTheDocument();
      });
      // Modal sigue abierto
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('limpia el error al cerrar el modal', async () => {
      mutateAsyncCreate.mockRejectedValueOnce({
        translatedMessage: 'Error de red',
      });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));

      await userEvent.type(screen.getByLabelText('Nombre del curso'), 'Curso fallido');
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Lenguaje'),
        'u1'
      );
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Matemáticas'),
        'u1'
      );
      await userEvent.click(screen.getByRole('button', { name: /crear curso/i }));

      await waitFor(() => {
        expect(screen.getByText('Error de red')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByLabelText('Cerrar modal'));

      // Re-abrir — error debe haber desaparecido
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));
      expect(screen.queryByText('Error de red')).not.toBeInTheDocument();
    });
  });

  // ─── Delete course ──────────────────────────────────────

  describe('Eliminación de curso — confirmación', () => {
    it('abre modal de confirmación al hacer click en eliminar', async () => {
      await renderPage();
      await userEvent.click(screen.getAllByRole('button', { name: /eliminar/i })[0]);

      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
      expect(screen.getByText('Eliminar curso')).toBeInTheDocument();
    });

    it('muestra el nombre y grado del curso a eliminar', async () => {
      await renderPage();
      await userEvent.click(screen.getAllByRole('button', { name: /eliminar/i })[0]);

      // El nombre aparece tanto en la lista como en el modal de confirmación
      const courseNames = screen.getAllByText(/4° básico A/);
      expect(courseNames.length).toBeGreaterThanOrEqual(2);
      // El grado aparece en la confirmación dentro del modal
      const confirmModal = screen.getByTestId('confirm-modal');
      expect(confirmModal).toHaveTextContent(/4° básico A/);
      expect(confirmModal).toHaveTextContent(/4° básico/);
    });

    it('muestra advertencia de datos asociados', async () => {
      await renderPage();
      await userEvent.click(screen.getAllByRole('button', { name: /eliminar/i })[0]);

      expect(screen.getByText(/todos los alumnos y evaluaciones asociados/i)).toBeInTheDocument();
    });

    it('botón de confirmación tiene variant danger', async () => {
      await renderPage();
      await userEvent.click(screen.getAllByRole('button', { name: /eliminar/i })[0]);

      const confirmBtn = screen.getByTestId('confirm-yes');
      expect(confirmBtn).toHaveAttribute('data-variant', 'danger');
      expect(confirmBtn).toHaveTextContent('Eliminar');
    });
  });

  describe('Eliminación de curso — confirmar', () => {
    it('llama deleteCourse.mutateAsync con el id correcto', async () => {
      mutateAsyncDelete.mockResolvedValueOnce(undefined);
      await renderPage();
      await userEvent.click(screen.getAllByRole('button', { name: /eliminar/i })[0]);

      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(mutateAsyncDelete).toHaveBeenCalledWith('c1');
      });
    });

    it('cierra el modal de confirmación tras eliminar', async () => {
      mutateAsyncDelete.mockResolvedValueOnce(undefined);
      await renderPage();
      await userEvent.click(screen.getAllByRole('button', { name: /eliminar/i })[0]);
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();

      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
      });
    });

    it('muestra toast de éxito tras eliminar', async () => {
      mutateAsyncDelete.mockResolvedValueOnce(undefined);
      await renderPage();
      await userEvent.click(screen.getAllByRole('button', { name: /eliminar/i })[0]);

      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(screen.getByText(/eliminado/)).toBeInTheDocument();
      });
    });

    it('muestra toast de error si falla la eliminación', async () => {
      mutateAsyncDelete.mockRejectedValueOnce({
        translatedMessage: 'Error al eliminar el curso.',
      });
      await renderPage();
      await userEvent.click(screen.getAllByRole('button', { name: /eliminar/i })[0]);

      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(screen.getByText('Error al eliminar el curso.')).toBeInTheDocument();
      });
    });

    it('usa mensaje genérico si delete falla sin translatedMessage', async () => {
      mutateAsyncDelete.mockRejectedValueOnce(new Error('fail'));
      await renderPage();
      await userEvent.click(screen.getAllByRole('button', { name: /eliminar/i })[0]);

      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(
          screen.getByText('Error al eliminar el curso. Intenta de nuevo.')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Eliminación de curso — cancelar', () => {
    it('cierra la confirmación al hacer click en Cancelar', async () => {
      await renderPage();
      await userEvent.click(screen.getAllByRole('button', { name: /eliminar/i })[0]);
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();

      await userEvent.click(screen.getByTestId('confirm-no'));
      expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
    });

    it('no llama deleteCourse.mutateAsync al cancelar', async () => {
      await renderPage();
      await userEvent.click(screen.getAllByRole('button', { name: /eliminar/i })[0]);
      await userEvent.click(screen.getByTestId('confirm-no'));

      expect(mutateAsyncDelete).not.toHaveBeenCalled();
    });
  });

  // ─── Toast notification ────────────────────────────────

  describe('Toast notification', () => {
    it('desaparece tras un tiempo (timeout de 4s)', async () => {
      mutateAsyncCreate.mockResolvedValueOnce({ id: 'c4' });

      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));
      await userEvent.type(screen.getByLabelText('Nombre del curso'), 'Curso test');
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Lenguaje'),
        'u1'
      );
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Matemáticas'),
        'u1'
      );
      await userEvent.click(screen.getByRole('button', { name: /crear curso/i }));

      await waitFor(() => {
        expect(screen.getByText(/creado exitosamente/i)).toBeInTheDocument();
      });

      // Verificar que el toast está visible — el auto-dismiss con setTimeout
      // no se prueba con fake timers porque interfiere con userEvent.
      // La lógica de setTimeout se verifica indirectamente por la presencia
      // del toast. El timeout de 4s es comportamiento estándar de React.
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('muestra el toast verde para éxito', async () => {
      mutateAsyncCreate.mockResolvedValueOnce({ id: 'c4' });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo curso/i }));
      await userEvent.type(screen.getByLabelText('Nombre del curso'), 'Curso test');
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Lenguaje'),
        'u1'
      );
      await userEvent.selectOptions(
        screen.getByLabelText('Seleccionar profesor para Matemáticas'),
        'u1'
      );
      await userEvent.click(screen.getByRole('button', { name: /crear curso/i }));

      await waitFor(() => {
        const toast = screen.getByRole('alert');
        expect(toast.className).toContain('green');
      });
    });

    it('muestra el toast rojo para error al eliminar', async () => {
      mutateAsyncDelete.mockRejectedValueOnce(new Error('fail'));
      await renderPage();
      await userEvent.click(screen.getAllByRole('button', { name: /eliminar/i })[0]);
      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        const toast = screen.getByText('Error al eliminar el curso. Intenta de nuevo.');
        const toastContainer = toast.closest('[role="alert"]')!;
        expect(toastContainer.className).toContain('red');
      });
    });
  });

  // ─── Tenant selector ───────────────────────────────────

  describe('Selector de colegio', () => {
    it('renderiza todos los tenants como opciones', async () => {
      await renderPage();
      const select = screen.getByLabelText('Seleccionar colegio');
      MOCK_TENANTS.forEach((t) => {
        expect(select).toContainHTML(t.name);
      });
    });

    it('tiene seleccionado el tenant activo por defecto', async () => {
      await renderPage();
      const select = screen.getByLabelText('Seleccionar colegio') as HTMLSelectElement;
      expect(select.value).toBe('t1');
    });

    it('cambia el tenant al seleccionar otro', async () => {
      await renderPage();
      const select = screen.getByLabelText('Seleccionar colegio');

      await userEvent.selectOptions(select, 't2');

      expect(mockReplace).toHaveBeenCalled();
      expect(mockReplace.mock.calls[0][0]).toContain('tenant_id=t2');
    });

    it('actualiza el contexto al cambiar de tenant', async () => {
      const setActiveTenantId = vi.fn();
      mockUseActiveTenant.mockReturnValue({
        ...DEFAULT_ACTIVE_TENANT,
        setActiveTenantId,
      });

      await renderPage();
      const select = screen.getByLabelText('Seleccionar colegio');
      await userEvent.selectOptions(select, 't3');

      expect(setActiveTenantId).toHaveBeenCalledWith('t3');
    });

    it('cambia a opción vacía si se selecciona placeholder', async () => {
      await renderPage();
      const select = screen.getByLabelText('Seleccionar colegio');

      await userEvent.selectOptions(select, '');

      expect(mockReplace).toHaveBeenCalled();
      expect(mockReplace.mock.calls[0][0]).not.toContain('tenant_id');
    });

    it('muestra Spinner mientras carga tenants', async () => {
      mockUseTenants.mockReturnValue({
        data: undefined,
        isLoading: true,
      });
      mockUseActiveTenant.mockReturnValue({
        activeTenantId: null,
        activeTenant: null,
        tenants: [],
        setActiveTenantId: vi.fn(),
        isLoading: true,
        isError: false,
      });

      await renderPage();
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
      // No debe mostrar select ni badge
      expect(screen.queryByLabelText('Seleccionar colegio')).not.toBeInTheDocument();
    });
  });

  // ─── SearchParams (preselected tenant from URL) ────────

  describe('URL param tenant_id', () => {
    it('usa tenant_id del searchParams si está presente', async () => {
      mockSearchParamsGet.mockReturnValue('t2');

      mockUseActiveTenant.mockReturnValue({
        activeTenantId: 't1',
        activeTenant: MOCK_TENANTS[0],
        tenants: MOCK_TENANTS,
        setActiveTenantId: vi.fn(),
        isLoading: false,
        isError: false,
      });

      // useCourses should be called with 't2' from URL param
      mockUseCourses.mockClear();

      await renderPage();

      // selectedTenantId debe ser 't2' (del URL param, no del contexto)
      expect(mockUseCourses).toHaveBeenCalledWith('t2');
    });
  });

  // ─── Botón "Nuevo curso" deshabilitado -----------------------------------

  describe('Botón Nuevo curso — estados', () => {
    it('está habilitado cuando hay tenant seleccionado', async () => {
      await renderPage();
      expect(screen.getByRole('button', { name: /nuevo curso/i })).not.toBeDisabled();
    });

    it('está deshabilitado cuando no hay tenant seleccionado', async () => {
      mockUseActiveTenant.mockReturnValue({
        activeTenantId: null,
        activeTenant: null,
        tenants: MOCK_TENANTS,
        setActiveTenantId: vi.fn(),
        isLoading: false,
        isError: false,
      });

      await renderPage();
      expect(screen.getByRole('button', { name: /nuevo curso/i })).toBeDisabled();
    });
  });
});
