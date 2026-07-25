import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks must be defined before any imports ───────────────────────

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: (...args: any[]) => mockUseAuth(...args),
}));

const mockUseTenants = vi.fn();
const mockUseCreateTenant = vi.fn();

vi.mock('@/hooks/useRelevoApi', () => ({
  useTenants: (...args: any[]) => mockUseTenants(...args),
  useCreateTenant: (...args: any[]) => mockUseCreateTenant(...args),
}));

vi.mock('@/lib/domain', () => ({
  formatTenantDomain: (tenant: any) => `${tenant.subdomain}.relevo.cl`,
  getDomainHint: () => '.relevo.cl',
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
  Input: ({ label, error, hint, ...props }: any) => (
    <div>
      {label && (
        <label htmlFor={props.id || label?.toLowerCase().replace(/\s+/g, '-')}>{label}</label>
      )}
      <input
        id={props.id || label?.toLowerCase().replace(/\s+/g, '-')}
        aria-label={label}
        {...props}
      />
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <span role="alert">{error}</span>}
    </div>
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
  School: () => <svg data-testid="icon-school" />,
  Plus: () => <svg data-testid="icon-plus" />,
  Building2: () => <svg data-testid="icon-building" />,
  ExternalLink: () => <svg data-testid="icon-external-link" />,
  X: () => <svg data-testid="icon-x" />,
  Copy: () => <svg data-testid="icon-copy" />,
  Check: () => <svg data-testid="icon-check" />,
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
  {
    id: 't3',
    name: 'Instituto Nacional',
    subdomain: 'instituto-nacional',
    join_code: 'GHI789',
    brand: 'relevo',
    settings: {},
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z',
  },
];

const DEFAULT_AUTH = {
  accessToken: 'mock-token',
  isAuthenticated: true,
  user: { id: '1', role: 'GESTION' },
};

// ─── Helpers ────────────────────────────────────────────────

async function renderPage() {
  const { default: ColegiosPage } = await getModule();
  return render(<ColegiosPage />);
}

// ─── Tests ──────────────────────────────────────────────────

describe('ColegiosPage', () => {
  let mutateAsyncCreate: ReturnType<typeof vi.fn>;
  let mockRefetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ ...DEFAULT_AUTH });

    mockRefetch = vi.fn();

    // Default tenants: loaded with data
    mockUseTenants.mockReturnValue({
      data: MOCK_TENANTS,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    mutateAsyncCreate = vi.fn();
    mockUseCreateTenant.mockReturnValue({
      mutateAsync: mutateAsyncCreate,
      isPending: false,
    });
  });

  // ─── Page structure ─────────────────────────────────────

  describe('Estructura de página', () => {
    it('renderiza el título y descripción', async () => {
      await renderPage();
      expect(screen.getByText('Colegios')).toBeInTheDocument();
      expect(screen.getByText('Gestiona tus establecimientos educacionales')).toBeInTheDocument();
    });

    it('renderiza el botón "Nuevo colegio"', async () => {
      await renderPage();
      const btn = screen.getByRole('button', { name: /nuevo colegio/i });
      expect(btn).toBeInTheDocument();
      expect(btn).not.toBeDisabled();
    });
  });

  // ─── Loading state ──────────────────────────────────────

  describe('Loading state', () => {
    it('muestra Spinner grande mientras carga', async () => {
      mockUseTenants.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: mockRefetch,
      });

      await renderPage();
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
      // No debe mostrar la lista ni empty state ni error
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
    });

    it('no muestra contenido de datos durante carga', async () => {
      mockUseTenants.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: mockRefetch,
      });

      await renderPage();
      expect(screen.queryByText('Colegio San Miguel')).not.toBeInTheDocument();
      expect(screen.queryByText('ABC123')).not.toBeInTheDocument();
    });
  });

  // ─── Error state ────────────────────────────────────────

  describe('Error state', () => {
    it('muestra mensaje de error y botón reintentar', async () => {
      mockUseTenants.mockReturnValue({
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
      mockUseTenants.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { detail: 'Server error' },
        refetch: mockRefetch,
      });

      await renderPage();
      expect(screen.getByTestId('error-message')).toHaveTextContent(
        'Error al cargar los colegios.'
      );
    });

    it('el botón reintentar llama refetch', async () => {
      mockUseTenants.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { translatedMessage: 'Error' },
        refetch: mockRefetch,
      });

      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
      expect(mockRefetch).toHaveBeenCalledOnce();
    });

    it('no muestra la lista ni empty state cuando hay error', async () => {
      mockUseTenants.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { translatedMessage: 'Error' },
        refetch: mockRefetch,
      });

      await renderPage();
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
    });
  });

  // ─── Empty state ────────────────────────────────────────

  describe('Empty state — sin colegios', () => {
    beforeEach(() => {
      mockUseTenants.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });
    });

    it('muestra EmptyState "No tienes colegios aún"', async () => {
      await renderPage();
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByTestId('empty-title')).toHaveTextContent('No tienes colegios aún');
      expect(screen.getByTestId('empty-description')).toHaveTextContent(/primer colegio/i);
      expect(screen.getByTestId('icon-building')).toBeInTheDocument();
    });

    it('muestra botón "Crear colegio" en el EmptyState', async () => {
      await renderPage();
      expect(screen.getByTestId('empty-action')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /crear colegio/i })).toBeInTheDocument();
    });

    it('el botón "Crear colegio" del EmptyState abre el modal', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /crear colegio/i }));
      expect(screen.getByRole('dialog', { name: /nuevo colegio/i })).toBeInTheDocument();
    });
  });

  // ─── Schools list ───────────────────────────────────────

  describe('Lista de colegios', () => {
    it('renderiza todos los colegios en la lista', async () => {
      await renderPage();
      const list = screen.getByRole('list', { name: /lista de colegios/i });
      expect(list).toBeInTheDocument();

      MOCK_TENANTS.forEach((tenant) => {
        expect(screen.getByText(tenant.name)).toBeInTheDocument();
      });
    });

    it('muestra el dominio formateado de cada colegio', async () => {
      await renderPage();
      expect(screen.getByText('san-miguel.relevo.cl')).toBeInTheDocument();
      expect(screen.getByText('gabriela-mistral.relevo.cl')).toBeInTheDocument();
      expect(screen.getByText('instituto-nacional.relevo.cl')).toBeInTheDocument();
    });

    it('muestra el código de registro (join_code) de cada colegio', async () => {
      await renderPage();
      expect(screen.getByText('ABC123')).toBeInTheDocument();
      expect(screen.getByText('DEF456')).toBeInTheDocument();
      expect(screen.getByText('GHI789')).toBeInTheDocument();
    });

    it('cada colegio tiene botón "Gestionar" con link a usuarios', async () => {
      await renderPage();
      const gestionarButtons = screen.getAllByRole('button', { name: /gestionar usuarios de/i });
      expect(gestionarButtons).toHaveLength(MOCK_TENANTS.length);

      // Click en el primero debería navegar
      await userEvent.click(gestionarButtons[0]);
      expect(mockPush).toHaveBeenCalledWith(`/dashboard/usuarios?tenant_id=${MOCK_TENANTS[0].id}`);
    });

    it('cada colegio tiene botón para copiar código de registro', async () => {
      await renderPage();
      const copyButtons = screen.getAllByRole('button', { name: /copiar código de registro de/i });
      expect(copyButtons).toHaveLength(MOCK_TENANTS.length);
    });

    it('cada colegio muestra icono School', async () => {
      await renderPage();
      const schoolIcons = screen.getAllByTestId('icon-school');
      expect(schoolIcons).toHaveLength(MOCK_TENANTS.length);
    });
  });

  // ─── Copy code ──────────────────────────────────────────

  describe('Copiar código de registro', () => {
    beforeEach(async () => {
      // Stub clipboard
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });
    });

    it('copia el join_code al portapapeles', async () => {
      await renderPage();
      const copyBtn = screen.getByRole('button', {
        name: `Copiar código de registro de ${MOCK_TENANTS[0].name}`,
      });
      await userEvent.click(copyBtn);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(MOCK_TENANTS[0].join_code);
    });

    it('muestra icono Check temporalmente tras copiar', async () => {
      await renderPage();
      const copyBtn = screen.getByRole('button', {
        name: `Copiar código de registro de ${MOCK_TENANTS[0].name}`,
      });
      await userEvent.click(copyBtn);

      // Debe mostrar el Check icon (copiedId === tenant.id)
      const checkIcons = screen.getAllByTestId('icon-check');
      expect(checkIcons.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Modal: abrir / cerrar ─────────────────────────────

  describe('Modal de crear colegio — apertura y cierre', () => {
    it('abre el modal al hacer click en "Nuevo colegio"', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo colegio/i }));
      expect(screen.getByRole('dialog', { name: /nuevo colegio/i })).toBeInTheDocument();
    });

    it('muestra el título "Nuevo colegio" en el modal', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo colegio/i }));
      expect(screen.getByRole('heading', { name: /nuevo colegio/i })).toBeInTheDocument();
    });

    it('cierra el modal al hacer click en la X', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo colegio/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Cerrar modal'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('cierra el modal al hacer click en Cancelar', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo colegio/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('cierra el modal al hacer click en el backdrop', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo colegio/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      const backdrop = screen.getByRole('dialog');
      await userEvent.click(backdrop);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('resetea el formulario al abrir el modal (múltiples veces)', async () => {
      await renderPage();

      // Abrir y llenar algo
      await userEvent.click(screen.getByRole('button', { name: /nuevo colegio/i }));
      const nameInput = screen.getByLabelText('Nombre del colegio');
      await userEvent.type(nameInput, 'Test Colegio');
      expect(nameInput).toHaveValue('Test Colegio');

      // Cerrar
      await userEvent.click(screen.getByLabelText('Cerrar modal'));

      // Re-abrir — el form debe estar limpio
      await userEvent.click(screen.getByRole('button', { name: /nuevo colegio/i }));
      const newNameInput = screen.getByLabelText('Nombre del colegio');
      expect(newNameInput).toHaveValue('');
    });
  });

  // ─── Formulario: campos ────────────────────────────────

  describe('Formulario de creación — campos', () => {
    beforeEach(async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo colegio/i }));
    });

    it('renderiza campo "Nombre del colegio"', () => {
      expect(screen.getByLabelText('Nombre del colegio')).toBeInTheDocument();
    });

    it('renderiza campo "Subdominio"', () => {
      expect(screen.getByLabelText('Subdominio')).toBeInTheDocument();
    });

    it('el campo subdominio convierte a minúsculas', async () => {
      const subdomainInput = screen.getByLabelText('Subdominio');
      await userEvent.type(subdomainInput, 'SAN-MARTIN');
      expect(subdomainInput).toHaveValue('san-martin');
    });

    it('el hint del subdominio incluye el dominio', () => {
      expect(screen.getByText(/se usará como san-martin\.relevo\.cl/i)).toBeInTheDocument();
    });
  });

  // ─── Formulario: validación ────────────────────────────

  describe('Formulario de creación — validación', () => {
    it('muestra error si nombre y subdominio están vacíos', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo colegio/i }));

      // Submit con campos vacíos
      const form = document.querySelector('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Todos los campos son obligatorios.')).toBeInTheDocument();
      });
      expect(mutateAsyncCreate).not.toHaveBeenCalled();
    });

    it('muestra error si solo se ingresan espacios', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo colegio/i }));

      await userEvent.type(screen.getByLabelText('Nombre del colegio'), '   ');
      await userEvent.type(screen.getByLabelText('Subdominio'), '   ');

      const form = document.querySelector('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Todos los campos son obligatorios.')).toBeInTheDocument();
      });
      expect(mutateAsyncCreate).not.toHaveBeenCalled();
    });

    it('muestra error si el subdominio tiene caracteres inválidos', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo colegio/i }));

      await userEvent.type(screen.getByLabelText('Nombre del colegio'), 'Colegio Test');
      await userEvent.type(screen.getByLabelText('Subdominio'), 'San Martín!');

      const form = document.querySelector('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getByText(
            'El subdominio solo puede contener letras minúsculas, números y guiones.'
          )
        ).toBeInTheDocument();
      });
      expect(mutateAsyncCreate).not.toHaveBeenCalled();
    });

    it('acepta subdominios con números y guiones', async () => {
      mockUseTenants.mockReturnValue({
        data: MOCK_TENANTS,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });
      mutateAsyncCreate.mockResolvedValueOnce({ id: 't4' });

      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo colegio/i }));

      await userEvent.type(screen.getByLabelText('Nombre del colegio'), 'Colegio 123');
      await userEvent.type(screen.getByLabelText('Subdominio'), 'colegio-123');

      await userEvent.click(screen.getByRole('button', { name: /crear colegio/i }));

      await waitFor(() => {
        expect(mutateAsyncCreate).toHaveBeenCalledWith({
          name: 'Colegio 123',
          subdomain: 'colegio-123',
        });
      });
    });
  });

  // ─── Formulario: submit exitoso ────────────────────────

  describe('Formulario de creación — submit exitoso', () => {
    it('llama createTenant.mutateAsync con los datos correctos', async () => {
      mutateAsyncCreate.mockResolvedValueOnce({ id: 't4' });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo colegio/i }));

      await userEvent.type(screen.getByLabelText('Nombre del colegio'), 'Colegio Nuevo');
      await userEvent.type(screen.getByLabelText('Subdominio'), 'colegio-nuevo');

      await userEvent.click(screen.getByRole('button', { name: /crear colegio/i }));

      await waitFor(() => {
        expect(mutateAsyncCreate).toHaveBeenCalledWith({
          name: 'Colegio Nuevo',
          subdomain: 'colegio-nuevo',
        });
      });
    });

    it('cierra el modal tras crear exitosamente', async () => {
      mutateAsyncCreate.mockResolvedValueOnce({ id: 't4' });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo colegio/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await userEvent.type(screen.getByLabelText('Nombre del colegio'), 'Colegio Nuevo');
      await userEvent.type(screen.getByLabelText('Subdominio'), 'colegio-nuevo');
      await userEvent.click(screen.getByRole('button', { name: /crear colegio/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('llama handleCloseModal al crear exitosamente', async () => {
      mutateAsyncCreate.mockResolvedValueOnce({ id: 't4' });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo colegio/i }));

      await userEvent.type(screen.getByLabelText('Nombre del colegio'), 'Colegio Test');
      await userEvent.type(screen.getByLabelText('Subdominio'), 'colegio-test');
      await userEvent.click(screen.getByRole('button', { name: /crear colegio/i }));

      // Modal cerrado → botón "Nuevo colegio" visible de nuevo
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /nuevo colegio/i })).toBeInTheDocument();
      });
    });
  });

  // ─── Formulario: error en API ──────────────────────────

  describe('Formulario de creación — error en API', () => {
    it('muestra translatedMessage del error de API', async () => {
      mutateAsyncCreate.mockRejectedValueOnce({
        translatedMessage: 'El subdominio ya está en uso.',
      });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo colegio/i }));

      await userEvent.type(screen.getByLabelText('Nombre del colegio'), 'Colegio Duplicado');
      await userEvent.type(screen.getByLabelText('Subdominio'), 'colegio-duplicado');
      await userEvent.click(screen.getByRole('button', { name: /crear colegio/i }));

      await waitFor(() => {
        expect(screen.getByText('El subdominio ya está en uso.')).toBeInTheDocument();
      });
    });

    it('muestra mensaje genérico si no hay translatedMessage', async () => {
      mutateAsyncCreate.mockRejectedValueOnce(new Error('Network error'));
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo colegio/i }));

      await userEvent.type(screen.getByLabelText('Nombre del colegio'), 'Colegio Fallido');
      await userEvent.type(screen.getByLabelText('Subdominio'), 'colegio-fallido');
      await userEvent.click(screen.getByRole('button', { name: /crear colegio/i }));

      await waitFor(() => {
        expect(
          screen.getByText('Error al crear el colegio. Intenta de nuevo.')
        ).toBeInTheDocument();
      });
    });

    it('el modal permanece abierto si hay error', async () => {
      mutateAsyncCreate.mockRejectedValueOnce({
        translatedMessage: 'Error de red',
      });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo colegio/i }));

      await userEvent.type(screen.getByLabelText('Nombre del colegio'), 'Colegio Fallido');
      await userEvent.type(screen.getByLabelText('Subdominio'), 'colegio-fallido');
      await userEvent.click(screen.getByRole('button', { name: /crear colegio/i }));

      await waitFor(() => {
        expect(screen.getByText('Error de red')).toBeInTheDocument();
      });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('limpia el error al cerrar el modal', async () => {
      mutateAsyncCreate.mockRejectedValueOnce({
        translatedMessage: 'Error de red',
      });
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo colegio/i }));

      await userEvent.type(screen.getByLabelText('Nombre del colegio'), 'Colegio Fallido');
      await userEvent.type(screen.getByLabelText('Subdominio'), 'colegio-fallido');
      await userEvent.click(screen.getByRole('button', { name: /crear colegio/i }));

      await waitFor(() => {
        expect(screen.getByText('Error de red')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByLabelText('Cerrar modal'));

      // Re-abrir — error debe haber desaparecido
      await userEvent.click(screen.getByRole('button', { name: /nuevo colegio/i }));
      expect(screen.queryByText('Error de red')).not.toBeInTheDocument();
    });
  });

  // ─── Botón "Nuevo colegio" siempre habilitado ──────────

  describe('Botón Nuevo colegio', () => {
    it('siempre está habilitado (no depende de tenant)', async () => {
      await renderPage();
      expect(screen.getByRole('button', { name: /nuevo colegio/i })).not.toBeDisabled();
    });

    it('abre modal incluso en empty state', async () => {
      mockUseTenants.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /nuevo colegio/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
