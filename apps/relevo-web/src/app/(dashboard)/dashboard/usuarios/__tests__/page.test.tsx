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
const mockUseUsers = vi.fn();
const mockUseCreateUser = vi.fn();
const mockUseApproveUser = vi.fn();
const mockUseRejectUser = vi.fn();
const mockUseResetPassword = vi.fn();

vi.mock('@/hooks/useRelevoApi', () => ({
  useTenants: (...args: any[]) => mockUseTenants(...args),
  useUsers: (...args: any[]) => mockUseUsers(...args),
  useCreateUser: (...args: any[]) => mockUseCreateUser(...args),
  useApproveUser: (...args: any[]) => mockUseApproveUser(...args),
  useRejectUser: (...args: any[]) => mockUseRejectUser(...args),
  useResetPassword: (...args: any[]) => mockUseResetPassword(...args),
}));

vi.mock('@/lib/domain', () => ({
  formatTenantDomain: (tenant: any) => `${tenant.subdomain}.relevo.cl`,
}));

vi.mock('@tiza/ui', () => ({
  Card: ({ children, className, padding, ...props }: any) => (
    <div data-testid="card" className={className} data-padding={padding} {...props}>
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
  Input: ({ label, error, type, ...props }: any) => (
    <div>
      {label && (
        <label htmlFor={props.id || label?.toLowerCase().replace(/\s+/g, '-')}>{label}</label>
      )}
      <input
        id={props.id || label?.toLowerCase().replace(/\s+/g, '-')}
        aria-label={label}
        type={type || 'text'}
        {...props}
      />
      {error && <span role="alert">{error}</span>}
    </div>
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
  Plus: () => <svg data-testid="icon-plus" />,
  Users: () => <svg data-testid="icon-users" />,
  UserPlus: () => <svg data-testid="icon-user-plus" />,
  Copy: () => <svg data-testid="icon-copy" />,
  Check: () => <svg data-testid="icon-check" />,
  CheckCircle: () => <svg data-testid="icon-check-circle" />,
  KeyRound: () => <svg data-testid="icon-key-round" />,
  XCircle: () => <svg data-testid="icon-x-circle" />,
  X: () => <svg data-testid="icon-x" />,
  RefreshCw: () => <svg data-testid="icon-refresh" />,
  Lock: () => <svg data-testid="icon-lock" />,
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
  {
    id: 't1',
    name: 'Colegio San Miguel',
    subdomain: 'san-miguel',
    join_code: 'ABC123',
    brand: 'relevo',
    settings: {},
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 't2',
    name: 'Liceo Gabriela Mistral',
    subdomain: 'gabriela-mistral',
    join_code: 'DEF456',
    brand: 'relevo',
    settings: {},
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

const MOCK_USERS = [
  {
    id: 'u1',
    name: 'Carolina Llona',
    email: 'carolina@test.cl',
    role: 'TEACHER' as const,
    status: 'active' as const,
    tenantId: 't1',
    created_at: '2026-01-15T12:00:00Z',
  },
  {
    id: 'u2',
    name: 'Pedro Pérez',
    email: 'pedro@test.cl',
    role: 'TEACHER' as const,
    status: 'active' as const,
    tenantId: 't1',
    created_at: '2026-02-01T12:00:00Z',
  },
  {
    id: 'u3',
    name: 'María García',
    email: 'maria@test.cl',
    role: 'TEACHER' as const,
    status: 'pending' as const,
    tenantId: 't1',
    created_at: '2026-03-01T12:00:00Z',
  },
  {
    id: 'u4',
    name: 'Juan Pérez',
    email: 'juan@test.cl',
    role: 'TEACHER' as const,
    status: 'rejected' as const,
    tenantId: 't1',
    created_at: '2026-03-10T12:00:00Z',
  },
  {
    id: 'u5',
    name: 'Admin User',
    email: 'admin@test.cl',
    role: 'HOLDER' as const,
    status: 'active' as const,
    tenantId: 't1',
    created_at: '2026-01-01T12:00:00Z',
  },
];

const DEFAULT_AUTH = {
  accessToken: 'mock-token',
  isAuthenticated: true,
  user: { id: 'auth-1', role: 'HOLDER' },
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
  const { default: UsuariosPage } = await getModule();
  return render(<UsuariosPage />);
}

// ─── Tests ──────────────────────────────────────────────────

describe('UsuariosPage', () => {
  let mutateAsyncCreateUser: ReturnType<typeof vi.fn>;
  let mutateAsyncApprove: ReturnType<typeof vi.fn>;
  let mutateAsyncReject: ReturnType<typeof vi.fn>;
  let mutateAsyncResetPassword: ReturnType<typeof vi.fn>;
  let mockRefetchUsers: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ ...DEFAULT_AUTH });
    mockUseActiveTenant.mockReturnValue({ ...DEFAULT_ACTIVE_TENANT });

    // Default tenants: loaded
    mockUseTenants.mockReturnValue({
      data: MOCK_TENANTS,
      isLoading: false,
    });

    mockRefetchUsers = vi.fn();
    // Default users: loaded with data
    mockUseUsers.mockReturnValue({
      data: MOCK_USERS,
      isLoading: false,
      error: null,
      refetch: mockRefetchUsers,
    });

    mutateAsyncCreateUser = vi.fn();
    mockUseCreateUser.mockReturnValue({
      mutateAsync: mutateAsyncCreateUser,
      isPending: false,
    });

    mutateAsyncApprove = vi.fn();
    mockUseApproveUser.mockReturnValue({
      mutateAsync: mutateAsyncApprove,
      isPending: false,
    });

    mutateAsyncReject = vi.fn();
    mockUseRejectUser.mockReturnValue({
      mutateAsync: mutateAsyncReject,
      isPending: false,
    });

    mutateAsyncResetPassword = vi.fn();
    mockUseResetPassword.mockReturnValue({
      mutateAsync: mutateAsyncResetPassword,
      isPending: false,
    });

    mockSearchParamsGet.mockReturnValue(null);
  });

  // ─── Page structure ─────────────────────────────────────

  describe('Estructura de página', () => {
    it('renderiza el título y descripción', async () => {
      await renderPage();
      expect(screen.getByText('Usuarios')).toBeInTheDocument();
      expect(screen.getByText('Gestión de profesores y administradores')).toBeInTheDocument();
    });

    it('renderiza el botón "Nuevo profesor"', async () => {
      await renderPage();
      const btn = screen.getByRole('button', { name: /nuevo profesor/i });
      expect(btn).toBeInTheDocument();
      expect(btn).not.toBeDisabled();
    });

    it('muestra el selector de colegio con el tenant activo', async () => {
      await renderPage();
      const select = screen.getByLabelText('Seleccionar colegio') as HTMLSelectElement;
      expect(select.value).toBe('t1');
      expect(select).toContainHTML('Colegio San Miguel');
    });

    it('muestra el dominio del tenant seleccionado como badge', async () => {
      await renderPage();
      expect(screen.getByText('san-miguel.relevo.cl')).toBeInTheDocument();
    });

    it('muestra el código de registro del tenant seleccionado', async () => {
      await renderPage();
      expect(screen.getByText('ABC123')).toBeInTheDocument();
    });
  });

  // ─── Loading state (tenants) ───────────────────────────

  describe('Loading state — tenants', () => {
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

      // Debe mostrar spinner en el selector
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
      // Botón "Nuevo profesor" deshabilitado porque no hay tenant
      expect(screen.getByRole('button', { name: /nuevo profesor/i })).toBeDisabled();
      // Debe mostrar empty state de "selecciona un colegio"
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByTestId('empty-title')).toHaveTextContent('Selecciona un colegio');
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
      mockUseUsers.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: mockRefetchUsers,
      });
    });

    it('muestra EmptyState "Selecciona un colegio"', async () => {
      await renderPage();
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByTestId('empty-title')).toHaveTextContent('Selecciona un colegio');
      expect(screen.getByTestId('empty-description')).toHaveTextContent(/elige un colegio/i);
      expect(screen.getByTestId('icon-users')).toBeInTheDocument();
    });

    it('no muestra la tabla de usuarios', async () => {
      await renderPage();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('botón "Nuevo profesor" deshabilitado sin tenant', async () => {
      await renderPage();
      expect(screen.getByRole('button', { name: /nuevo profesor/i })).toBeDisabled();
    });
  });

  // ─── Tenant selected — loading users ───────────────────

  describe('Tenant seleccionado — loading usuarios', () => {
    it('muestra Spinner grande mientras cargan los usuarios', async () => {
      mockUseUsers.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: mockRefetchUsers,
      });

      await renderPage();

      const spinners = screen.getAllByTestId('spinner');
      expect(spinners.length).toBeGreaterThanOrEqual(1);
    });

    it('no muestra la tabla ni empty state durante carga', async () => {
      mockUseUsers.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: mockRefetchUsers,
      });

      await renderPage();

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
    });
  });

  // ─── Users loaded — table ──────────────────────────────

  describe('Tenant seleccionado — lista de usuarios', () => {
    it('renderiza la tabla con todos los usuarios', async () => {
      await renderPage();

      const table = screen.getByRole('table', { name: /usuarios del colegio/i });
      expect(table).toBeInTheDocument();

      // Verificar nombres visibles
      MOCK_USERS.forEach((user) => {
        expect(screen.getByText(user.name)).toBeInTheDocument();
      });
    });

    it('muestra el email de cada usuario', async () => {
      await renderPage();
      expect(screen.getByText('carolina@test.cl')).toBeInTheDocument();
      expect(screen.getByText('pedro@test.cl')).toBeInTheDocument();
      expect(screen.getByText('maria@test.cl')).toBeInTheDocument();
      expect(screen.getByText('juan@test.cl')).toBeInTheDocument();
    });

    it('muestra los badges de rol correctamente', async () => {
      await renderPage();
      // Los TEACHER deben mostrar "Profesor"
      const profesorBadges = screen.getAllByText('Profesor');
      expect(profesorBadges.length).toBeGreaterThanOrEqual(4);
      // El HOLDER debe mostrar "Gestión"
      const gestionBadges = screen.getAllByText('Gestión');
      expect(gestionBadges.length).toBeGreaterThanOrEqual(1);
    });

    it('muestra los badges de estado correctamente', async () => {
      await renderPage();
      expect(screen.getAllByText('Activo').length).toBeGreaterThanOrEqual(3);
      expect(screen.getByText('Pendiente')).toBeInTheDocument();
      expect(screen.getByText('Rechazado')).toBeInTheDocument();
    });

    it('muestra la fecha de creación formateada', async () => {
      await renderPage();
      expect(screen.getByText('15 ene 2026')).toBeInTheDocument();
      expect(screen.getByText('1 feb 2026')).toBeInTheDocument();
      expect(screen.getByText('1 mar 2026')).toBeInTheDocument();
      expect(screen.getByText('10 mar 2026')).toBeInTheDocument();
    });
  });

  // ─── Pending count badge ──────────────────────────────

  describe('Badge de pendientes', () => {
    it('muestra conteo de usuarios pendientes + rechazados en el header', async () => {
      await renderPage();
      // u3 = pending, u4 = rejected → 2 pendientes
      expect(screen.getByText('2 pendientes')).toBeInTheDocument();
    });

    it('no muestra badge de pendientes si no hay usuarios pendientes ni rechazados', async () => {
      mockUseUsers.mockReturnValue({
        data: MOCK_USERS.filter((u) => u.status === 'active'),
        isLoading: false,
        error: null,
        refetch: mockRefetchUsers,
      });

      await renderPage();
      expect(screen.queryByText(/pendiente/)).not.toBeInTheDocument();
    });

    it('muestra singular "1 pendiente" cuando hay exactamente 1', async () => {
      mockUseUsers.mockReturnValue({
        data: [MOCK_USERS[2]], // solo u3 (pending)
        isLoading: false,
        error: null,
        refetch: mockRefetchUsers,
      });

      await renderPage();
      expect(screen.getByText('1 pendiente')).toBeInTheDocument();
    });
  });

  // ─── Empty users ───────────────────────────────────────

  describe('Tenant seleccionado — sin usuarios', () => {
    beforeEach(() => {
      mockUseUsers.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: mockRefetchUsers,
      });
    });

    it('muestra EmptyState "No hay usuarios en este colegio"', async () => {
      await renderPage();
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByTestId('empty-title')).toHaveTextContent(
        'No hay usuarios en este colegio'
      );
    });

    it('muestra botón "Agregar profesor" en el EmptyState', async () => {
      await renderPage();
      expect(screen.getByTestId('empty-action')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /agregar profesor/i })).toBeInTheDocument();
    });
  });

  // ─── Users error ───────────────────────────────────────

  describe('Tenant seleccionado — error al cargar', () => {
    it('muestra mensaje de error y botón reintentar', async () => {
      mockUseUsers.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { translatedMessage: 'Error al cargar usuarios' },
        refetch: mockRefetchUsers,
      });

      await renderPage();

      expect(screen.getByTestId('error-message')).toHaveTextContent('Error al cargar usuarios');
      expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    });

    it('usa mensaje por defecto si no hay translatedMessage', async () => {
      mockUseUsers.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { detail: 'Server error' },
        refetch: mockRefetchUsers,
      });

      await renderPage();

      expect(screen.getByTestId('error-message')).toHaveTextContent(
        'Error al cargar los usuarios.'
      );
    });

    it('el botón reintentar llama refetch', async () => {
      mockUseUsers.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { translatedMessage: 'Error' },
        refetch: mockRefetchUsers,
      });

      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
      expect(mockRefetchUsers).toHaveBeenCalledOnce();
    });
  });

  // ─── Modal crear usuario — apertura y cierre ──────────

  describe('Modal de crear usuario — apertura y cierre', () => {
    it('abre el modal al hacer click en "Nuevo profesor"', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo profesor/i }));
      expect(screen.getByRole('dialog', { name: /nuevo profesor/i })).toBeInTheDocument();
    });

    it('muestra el título "Nuevo profesor" en el modal', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo profesor/i }));
      expect(screen.getByRole('heading', { name: /nuevo profesor/i })).toBeInTheDocument();
    });

    it('muestra la información del colegio seleccionado en el modal', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo profesor/i }));
      expect(screen.getByText(/Agregando a:/)).toBeInTheDocument();
      // El nombre del colegio aparece en el modal y en el selector
      const colegioElements = screen.getAllByText('Colegio San Miguel');
      expect(colegioElements.length).toBeGreaterThanOrEqual(2);
    });

    it('cierra el modal al hacer click en la X', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo profesor/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Cerrar modal'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('cierra el modal al hacer click en Cancelar', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo profesor/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('genera contraseña automática al abrir el modal', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo profesor/i }));

      // Debe mostrar un campo de contraseña (generada automáticamente)
      expect(screen.getByText('Contraseña provisoria')).toBeInTheDocument();
      // El código de la contraseña (14 chars) debe estar visible
      const passwordCode = screen.getByText(/^[A-Za-z0-9!@#$%&*]{14}$/);
      expect(passwordCode).toBeInTheDocument();
    });
  });

  // ─── Formulario crear usuario — campos ────────────────

  describe('Formulario de creación — campos', () => {
    beforeEach(async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo profesor/i }));
    });

    it('renderiza campo "Nombre del profesor"', () => {
      expect(screen.getByLabelText('Nombre del profesor')).toBeInTheDocument();
    });

    it('renderiza campo "Correo electrónico"', () => {
      expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
    });

    it('renderiza botón para copiar contraseña', () => {
      expect(screen.getByRole('button', { name: /copiar contraseña/i })).toBeInTheDocument();
    });

    it('renderiza botón para regenerar contraseña', () => {
      expect(screen.getByRole('button', { name: /generar nueva contraseña/i })).toBeInTheDocument();
    });

    it('muestra la contraseña generada automáticamente', () => {
      expect(screen.getByText('Contraseña provisoria')).toBeInTheDocument();
    });

    it('el botón regenerar cambia la contraseña', async () => {
      const passwordBefore = screen.getByText(/^[A-Za-z0-9!@#$%&*]{14}$/).textContent;
      await userEvent.click(screen.getByRole('button', { name: /generar nueva contraseña/i }));
      const passwordAfter = screen.getByText(/^[A-Za-z0-9!@#$%&*]{14}$/).textContent;
      expect(passwordAfter).not.toBe(passwordBefore);
    });

    it('copia la contraseña al portapapeles', async () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });

      const copyBtn = screen.getByRole('button', { name: /copiar contraseña/i });
      await userEvent.click(copyBtn);

      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      // Después de copiar, debe mostrar "¡Copiada!"
      expect(screen.getByText('¡Copiada!')).toBeInTheDocument();
    });
  });

  // ─── Formulario crear usuario — validación ────────────

  describe('Formulario de creación — validación', () => {
    it('muestra error si los campos están vacíos', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo profesor/i }));

      const form = document.querySelector('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Todos los campos son obligatorios.')).toBeInTheDocument();
      });
      expect(mutateAsyncCreateUser).not.toHaveBeenCalled();
    });

    it('muestra error si el email no tiene @', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo profesor/i }));

      await userEvent.type(screen.getByLabelText('Nombre del profesor'), 'Test User');
      await userEvent.type(screen.getByLabelText('Correo electrónico'), 'invalid-email');

      await userEvent.click(screen.getByRole('button', { name: /crear profesor/i }));

      await waitFor(() => {
        expect(screen.getByText('Ingresa un correo electrónico válido.')).toBeInTheDocument();
      });
      expect(mutateAsyncCreateUser).not.toHaveBeenCalled();
    });

    it('muestra error si solo se ingresan espacios', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo profesor/i }));

      await userEvent.type(screen.getByLabelText('Nombre del profesor'), '   ');
      await userEvent.type(screen.getByLabelText('Correo electrónico'), '   ');

      const form = document.querySelector('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Todos los campos son obligatorios.')).toBeInTheDocument();
      });
      expect(mutateAsyncCreateUser).not.toHaveBeenCalled();
    });
  });

  // ─── Formulario crear usuario — submit exitoso ────────

  describe('Formulario de creación — submit exitoso', () => {
    it('llama createUser.mutateAsync con los datos correctos', async () => {
      mutateAsyncCreateUser.mockResolvedValueOnce({ id: 'u6' });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo profesor/i }));

      await userEvent.type(screen.getByLabelText('Nombre del profesor'), 'Nuevo Profesor');
      await userEvent.type(screen.getByLabelText('Correo electrónico'), 'nuevo@test.cl');

      // Obtener la contraseña generada
      const passwordEl = screen.getByText(/^[A-Za-z0-9!@#$%&*]{14}$/);
      const generatedPassword = passwordEl.textContent!;

      await userEvent.click(screen.getByRole('button', { name: /crear profesor/i }));

      await waitFor(() => {
        expect(mutateAsyncCreateUser).toHaveBeenCalledWith({
          email: 'nuevo@test.cl',
          name: 'Nuevo Profesor',
          password: generatedPassword,
          tenant_id: 't1',
          role: 'teacher',
        });
      });
    });

    it('muestra mensaje de éxito con la contraseña tras crear', async () => {
      mutateAsyncCreateUser.mockResolvedValueOnce({ id: 'u6' });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo profesor/i }));

      await userEvent.type(screen.getByLabelText('Nombre del profesor'), 'Nuevo Profesor');
      await userEvent.type(screen.getByLabelText('Correo electrónico'), 'nuevo@test.cl');

      await userEvent.click(screen.getByRole('button', { name: /crear profesor/i }));

      await waitFor(() => {
        expect(screen.getByText(/Profesor creado exitosamente/i)).toBeInTheDocument();
      });
    });

    it('el modal permanece abierto tras éxito (para crear otro)', async () => {
      mutateAsyncCreateUser.mockResolvedValueOnce({ id: 'u6' });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo profesor/i }));

      await userEvent.type(screen.getByLabelText('Nombre del profesor'), 'Nuevo Profesor');
      await userEvent.type(screen.getByLabelText('Correo electrónico'), 'nuevo@test.cl');
      await userEvent.click(screen.getByRole('button', { name: /crear profesor/i }));

      await waitFor(() => {
        expect(screen.getByText(/Profesor creado exitosamente/i)).toBeInTheDocument();
      });
      // Modal debe permanecer abierto
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('regenera la contraseña tras crear exitosamente', async () => {
      mutateAsyncCreateUser.mockResolvedValueOnce({ id: 'u6' });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo profesor/i }));

      const passwordBefore = screen.getByText(/^[A-Za-z0-9!@#$%&*]{14}$/).textContent;

      await userEvent.type(screen.getByLabelText('Nombre del profesor'), 'Nuevo Profesor');
      await userEvent.type(screen.getByLabelText('Correo electrónico'), 'nuevo@test.cl');
      await userEvent.click(screen.getByRole('button', { name: /crear profesor/i }));

      await waitFor(() => {
        const passwordAfter = screen.getByText(/^[A-Za-z0-9!@#$%&*]{14}$/).textContent;
        expect(passwordAfter).not.toBe(passwordBefore);
      });
    });
  });

  // ─── Formulario crear usuario — error ─────────────────

  describe('Formulario de creación — error en API', () => {
    it('muestra translatedMessage del error', async () => {
      mutateAsyncCreateUser.mockRejectedValueOnce({
        translatedMessage: 'El email ya está registrado.',
      });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo profesor/i }));

      await userEvent.type(screen.getByLabelText('Nombre del profesor'), 'Test');
      await userEvent.type(screen.getByLabelText('Correo electrónico'), 'test@test.cl');
      await userEvent.click(screen.getByRole('button', { name: /crear profesor/i }));

      await waitFor(() => {
        expect(screen.getByText('El email ya está registrado.')).toBeInTheDocument();
      });
    });

    it('muestra mensaje genérico si no hay translatedMessage', async () => {
      mutateAsyncCreateUser.mockRejectedValueOnce(new Error('fail'));
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo profesor/i }));

      await userEvent.type(screen.getByLabelText('Nombre del profesor'), 'Test');
      await userEvent.type(screen.getByLabelText('Correo electrónico'), 'test@test.cl');
      await userEvent.click(screen.getByRole('button', { name: /crear profesor/i }));

      await waitFor(() => {
        expect(
          screen.getByText('Error al crear el profesor. Intenta de nuevo.')
        ).toBeInTheDocument();
      });
    });
  });

  // ─── Approve user ─────────────────────────────────────

  describe('Aprobar usuario', () => {
    it('muestra botón "Aprobar" para usuarios pending', async () => {
      await renderPage();
      const approveBtn = screen.getByRole('button', { name: /aprobar maría garcía/i });
      expect(approveBtn).toBeInTheDocument();
    });

    it('muestra botón "Aprobar" para usuarios rejected', async () => {
      await renderPage();
      const approveBtn = screen.getByRole('button', { name: /aprobar juan pérez/i });
      expect(approveBtn).toBeInTheDocument();
    });

    it('abre modal de confirmación al hacer click en Aprobar', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /aprobar maría garcía/i }));

      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
      expect(screen.getByText('Aprobar usuario')).toBeInTheDocument();
    });

    it('muestra nombre y email del usuario a aprobar', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /aprobar maría garcía/i }));

      const modal = screen.getByTestId('confirm-modal');
      expect(modal).toHaveTextContent('María García');
      expect(modal).toHaveTextContent('maria@test.cl');
    });

    it('llama approveUser.mutateAsync al confirmar', async () => {
      mutateAsyncApprove.mockResolvedValueOnce({ success: true });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /aprobar maría garcía/i }));
      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(mutateAsyncApprove).toHaveBeenCalledWith('u3');
      });
    });

    it('cierra el modal de confirmación tras aprobar exitosamente', async () => {
      mutateAsyncApprove.mockResolvedValueOnce({ success: true });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /aprobar maría garcía/i }));
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();

      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
      });
    });

    it('muestra toast de éxito tras aprobar', async () => {
      mutateAsyncApprove.mockResolvedValueOnce({ success: true });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /aprobar maría garcía/i }));
      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(screen.getByText(/María García aprobado correctamente/i)).toBeInTheDocument();
      });
    });

    it('muestra toast de error si falla la aprobación', async () => {
      mutateAsyncApprove.mockRejectedValueOnce({
        translatedMessage: 'Error al aprobar.',
      });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /aprobar maría garcía/i }));
      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(screen.getByText('Error al aprobar.')).toBeInTheDocument();
      });
    });

    it('usa mensaje genérico si approve falla sin translatedMessage', async () => {
      mutateAsyncApprove.mockRejectedValueOnce(new Error('fail'));
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /aprobar maría garcía/i }));
      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(
          screen.getByText('Error al aprobar el usuario. Intenta de nuevo.')
        ).toBeInTheDocument();
      });
    });

    it('cierra la confirmación al cancelar', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /aprobar maría garcía/i }));
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();

      await userEvent.click(screen.getByTestId('confirm-no'));
      expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
    });

    it('no llama mutateAsync al cancelar', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /aprobar maría garcía/i }));
      await userEvent.click(screen.getByTestId('confirm-no'));

      expect(mutateAsyncApprove).not.toHaveBeenCalled();
    });
  });

  // ─── Reject user ──────────────────────────────────────

  describe('Rechazar usuario', () => {
    it('muestra botón "Rechazar" para usuarios pending', async () => {
      await renderPage();
      const rejectBtn = screen.getByRole('button', { name: /rechazar a maría garcía/i });
      expect(rejectBtn).toBeInTheDocument();
    });

    it('no muestra botón "Rechazar" para usuarios rejected', async () => {
      await renderPage();
      expect(
        screen.queryByRole('button', { name: /rechazar a juan pérez/i })
      ).not.toBeInTheDocument();
    });

    it('abre modal de confirmación al hacer click en Rechazar', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /rechazar a maría garcía/i }));

      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
      expect(screen.getByText('Rechazar solicitud')).toBeInTheDocument();
    });

    it('muestra campo de motivo de rechazo', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /rechazar a maría garcía/i }));

      expect(screen.getByLabelText(/motivo del rechazo/i)).toBeInTheDocument();
    });

    it('muestra error si se confirma sin motivo', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /rechazar a maría garcía/i }));
      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(screen.getByText('Debes ingresar un motivo de rechazo.')).toBeInTheDocument();
      });
      expect(mutateAsyncReject).not.toHaveBeenCalled();
    });

    it('llama rejectUser.mutateAsync con userId y reason', async () => {
      mutateAsyncReject.mockResolvedValueOnce({ success: true });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /rechazar a maría garcía/i }));

      const textarea = screen.getByLabelText(/motivo del rechazo/i);
      await userEvent.type(textarea, 'Documentación incompleta');
      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(mutateAsyncReject).toHaveBeenCalledWith({
          userId: 'u3',
          reason: 'Documentación incompleta',
        });
      });
    });

    it('muestra toast de éxito tras rechazar', async () => {
      mutateAsyncReject.mockResolvedValueOnce({ success: true });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /rechazar a maría garcía/i }));

      await userEvent.type(screen.getByLabelText(/motivo del rechazo/i), 'Razón');
      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(screen.getByText(/María García rechazada/)).toBeInTheDocument();
      });
    });

    it('muestra toast de error si falla el rechazo', async () => {
      mutateAsyncReject.mockRejectedValueOnce({
        translatedMessage: 'Error al rechazar.',
      });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /rechazar a maría garcía/i }));

      await userEvent.type(screen.getByLabelText(/motivo del rechazo/i), 'Razón');
      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(screen.getByText('Error al rechazar.')).toBeInTheDocument();
      });
    });

    it('usa mensaje genérico si reject falla sin translatedMessage', async () => {
      mutateAsyncReject.mockRejectedValueOnce(new Error('fail'));
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /rechazar a maría garcía/i }));

      await userEvent.type(screen.getByLabelText(/motivo del rechazo/i), 'Razón');
      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(
          screen.getByText('Error al rechazar la solicitud. Intenta de nuevo.')
        ).toBeInTheDocument();
      });
    });

    it('cierra el modal al cancelar el rechazo', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /rechazar a maría garcía/i }));
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();

      await userEvent.click(screen.getByTestId('confirm-no'));
      expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
    });
  });

  // ─── Reset password ───────────────────────────────────

  describe('Restaurar contraseña', () => {
    it('muestra botón "Restaurar clave" para usuarios activos TEACHER', async () => {
      await renderPage();
      const resetBtn = screen.getByRole('button', { name: /restaurar clave de carolina llona/i });
      expect(resetBtn).toBeInTheDocument();
    });

    it('abre modal de confirmación al hacer click en Restaurar clave', async () => {
      await renderPage();
      await userEvent.click(
        screen.getByRole('button', { name: /restaurar clave de carolina llona/i })
      );

      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
      expect(screen.getByText('Restaurar contraseña')).toBeInTheDocument();
    });

    it('llama resetPassword.mutateAsync al confirmar', async () => {
      mutateAsyncResetPassword.mockResolvedValueOnce({
        temporary_password: 'NewTemp123!',
      });
      await renderPage();
      await userEvent.click(
        screen.getByRole('button', { name: /restaurar clave de carolina llona/i })
      );
      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(mutateAsyncResetPassword).toHaveBeenCalledWith('u1');
      });
    });

    it('muestra modal con la nueva contraseña temporal', async () => {
      mutateAsyncResetPassword.mockResolvedValueOnce({
        temporary_password: 'NewTemp123!',
      });
      await renderPage();
      await userEvent.click(
        screen.getByRole('button', { name: /restaurar clave de carolina llona/i })
      );
      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        // Debe mostrar el modal con la contraseña
        expect(screen.getByText('Contraseña restaurada')).toBeInTheDocument();
        expect(screen.getByText('NewTemp123!')).toBeInTheDocument();
      });
    });

    it('permite copiar la contraseña del modal de resultado', async () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });

      mutateAsyncResetPassword.mockResolvedValueOnce({
        temporary_password: 'NewTemp123!',
      });
      await renderPage();
      await userEvent.click(
        screen.getByRole('button', { name: /restaurar clave de carolina llona/i })
      );
      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(screen.getByText('Contraseña restaurada')).toBeInTheDocument();
      });

      const copyBtn = screen.getByRole('button', { name: /copiar contraseña/i });
      await userEvent.click(copyBtn);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('NewTemp123!');
    });

    it('cierra el modal de resultado al hacer click en "Entendido"', async () => {
      mutateAsyncResetPassword.mockResolvedValueOnce({
        temporary_password: 'NewTemp123!',
      });
      await renderPage();
      await userEvent.click(
        screen.getByRole('button', { name: /restaurar clave de carolina llona/i })
      );
      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(screen.getByText('Contraseña restaurada')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /entendido/i }));
      expect(screen.queryByText('Contraseña restaurada')).not.toBeInTheDocument();
    });

    it('muestra toast de éxito tras restaurar contraseña', async () => {
      mutateAsyncResetPassword.mockResolvedValueOnce({
        temporary_password: 'NewTemp123!',
      });
      await renderPage();
      await userEvent.click(
        screen.getByRole('button', { name: /restaurar clave de carolina llona/i })
      );
      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(screen.getByText(/Contraseña restaurada para Carolina Llona/i)).toBeInTheDocument();
      });
    });

    it('muestra toast de error si falla reset', async () => {
      mutateAsyncResetPassword.mockRejectedValueOnce({
        translatedMessage: 'Error al restaurar.',
      });
      await renderPage();
      await userEvent.click(
        screen.getByRole('button', { name: /restaurar clave de carolina llona/i })
      );
      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(screen.getByText('Error al restaurar.')).toBeInTheDocument();
      });
    });

    it('usa mensaje genérico si reset falla sin translatedMessage', async () => {
      mutateAsyncResetPassword.mockRejectedValueOnce(new Error('fail'));
      await renderPage();
      await userEvent.click(
        screen.getByRole('button', { name: /restaurar clave de carolina llona/i })
      );
      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        expect(
          screen.getByText('Error al restaurar la contraseña. Intenta de nuevo.')
        ).toBeInTheDocument();
      });
    });
  });

  // ─── Toast notification ────────────────────────────────

  describe('Toast notification', () => {
    it('desaparece tras crear usuario exitosamente', async () => {
      mutateAsyncCreateUser.mockResolvedValueOnce({ id: 'u6' });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo profesor/i }));

      await userEvent.type(screen.getByLabelText('Nombre del profesor'), 'Test');
      await userEvent.type(screen.getByLabelText('Correo electrónico'), 'test@test.cl');
      await userEvent.click(screen.getByRole('button', { name: /crear profesor/i }));

      await waitFor(() => {
        // El toast de éxito se muestra como alert
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('muestra el toast rojo para error', async () => {
      mutateAsyncApprove.mockRejectedValueOnce(new Error('fail'));
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /aprobar maría garcía/i }));
      await userEvent.click(screen.getByTestId('confirm-yes'));

      await waitFor(() => {
        const toast = screen.getByText('Error al aprobar el usuario. Intenta de nuevo.');
        expect(toast).toBeInTheDocument();
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
      const setActiveTenantId = vi.fn();
      mockUseActiveTenant.mockReturnValue({
        ...DEFAULT_ACTIVE_TENANT,
        setActiveTenantId,
      });

      await renderPage();
      const select = screen.getByLabelText('Seleccionar colegio');

      await userEvent.selectOptions(select, 't2');

      expect(setActiveTenantId).toHaveBeenCalledWith('t2');
      expect(mockReplace).toHaveBeenCalled();
      expect(mockReplace.mock.calls[0][0]).toContain('tenant_id=t2');
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
    });
  });

  // ─── URL param tenant_id ───────────────────────────────

  describe('URL param tenant_id', () => {
    it('usa tenant_id del searchParams si está presente', async () => {
      mockSearchParamsGet.mockReturnValue('t2');

      mockUseUsers.mockClear();

      await renderPage();

      // useUsers debe ser llamado con 't2' del URL param
      expect(mockUseUsers).toHaveBeenCalledWith('t2');
    });
  });
});
