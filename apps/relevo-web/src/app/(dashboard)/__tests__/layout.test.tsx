import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks must be defined before any imports ───────────────────────

const mockPush = vi.fn();
const mockPathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: mockPush }),
}));

// Link as a plain <a> for testing
vi.mock('next/link', () => ({
  default: ({ children, href, onClick, className, prefetch: _prefetch, ...rest }: any) => (
    <a href={href} onClick={onClick} className={className} {...rest}>
      {children}
    </a>
  ),
}));

const mockLogout = vi.fn();
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: (...args: any[]) => mockUseAuth(...args),
}));

const mockUseFeatures = vi.fn();
vi.mock('@/hooks/useFeatures', () => ({
  useFeatures: (...args: any[]) => mockUseFeatures(...args),
}));

// Mock setActiveTenantId that delegates to localStorage (mirrors real implementation)
const mockSetActiveTenantId = vi.fn((id: string) => {
  localStorage.setItem('relevo-active-tenant', id);
});
const mockUseActiveTenant = vi.fn();
vi.mock('@/hooks/ActiveTenantContext', () => ({
  ActiveTenantProvider: ({ children }: any) => children,
  useActiveTenant: (...args: any[]) => mockUseActiveTenant(...args),
}));

// ─── Import after mocks ─────────────────────────────────────────────

import DashboardLayout from '../layout';

// ─── Helpers ────────────────────────────────────────────────────────

// Mock tenants matching the old SIMULATED_TENANTS for test backward-compatibility
const MOCK_TENANTS = [
  {
    id: 't1',
    name: 'Colegio San Miguel',
    subdomain: 'san-miguel',
    join_code: 'abc1',
    brand: 'relevo',
    settings: {},
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: 't2',
    name: 'Liceo Gabriela Mistral',
    subdomain: 'gabriela-mistral',
    join_code: 'abc2',
    brand: 'relevo',
    settings: {},
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: 't3',
    name: 'Instituto Nacional',
    subdomain: 'instituto-nacional',
    join_code: 'abc3',
    brand: 'relevo',
    settings: {},
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: 't4',
    name: 'Colegio Los Olivos',
    subdomain: 'los-olivos',
    join_code: 'abc4',
    brand: 'relevo',
    settings: {},
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: 't5',
    name: 'Colegio Santa María',
    subdomain: 'santa-maria',
    join_code: 'abc5',
    brand: 'relevo',
    settings: {},
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
];

const DEFAULT_AUTH = {
  user: {
    id: '1',
    email: 'director@colegio.cl',
    name: 'Director Test',
    role: 'GESTION',
    tenantId: 't1',
  },
  isAuthenticated: true,
  isLoading: false,
  logout: mockLogout,
  token: 'fake-token',
  accessToken: 'fake-token',
  login: vi.fn(),
  register: vi.fn(),
};

const DEFAULT_FEATURES = {
  features: { multiSchool: false },
  brand: 'relevo',
  isLoading: false,
  isLoaded: true,
};

const DEFAULT_ACTIVE_TENANT = {
  activeTenantId: 't1',
  activeTenant: MOCK_TENANTS[0],
  tenants: MOCK_TENANTS,
  setActiveTenantId: mockSetActiveTenantId,
  isLoading: false,
  isError: false,
};

function renderLayout() {
  return render(
    <div id="test-wrapper">
      <DashboardLayout>
        <div data-testid="children-content">Dashboard Content</div>
      </DashboardLayout>
    </div>
  );
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('DashboardLayout', () => {
  // Exposed so individual tests can pre-populate localStorage before render
  let localStorageStore: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue('/dashboard');
    mockUseAuth.mockReturnValue({ ...DEFAULT_AUTH });
    mockUseFeatures.mockReturnValue({ ...DEFAULT_FEATURES });
    mockUseActiveTenant.mockReturnValue({ ...DEFAULT_ACTIVE_TENANT });

    // Mock localStorage — exposed via closure for test-level customization
    localStorageStore = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
      (key: string) => localStorageStore[key] ?? null
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      localStorageStore[key] = value;
    });
  });

  // ─── Loading state ──────────────────────────────────────────────

  describe('Loading state', () => {
    it('muestra "Cargando..." mientras isLoading es true', () => {
      mockUseAuth.mockReturnValue({ ...DEFAULT_AUTH, isLoading: true, isAuthenticated: false });
      renderLayout();
      expect(screen.getByText('Cargando...')).toBeInTheDocument();
    });

    it('no renderiza el sidebar mientras isLoading es true', () => {
      mockUseAuth.mockReturnValue({ ...DEFAULT_AUTH, isLoading: true, isAuthenticated: false });
      renderLayout();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('Colegios')).not.toBeInTheDocument();
    });
  });

  // ─── Auth guard ─────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('redirige a /login si el usuario no está autenticado', () => {
      mockUseAuth.mockReturnValue({ ...DEFAULT_AUTH, isAuthenticated: false, isLoading: false });
      renderLayout();
      expect(mockPush).toHaveBeenCalledWith('/login');
    });

    it('no redirige a /login si isLoading es true (evita flash)', () => {
      mockUseAuth.mockReturnValue({ ...DEFAULT_AUTH, isAuthenticated: false, isLoading: true });
      renderLayout();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('retorna null (no renderiza nada) si no está autenticado tras carga', () => {
      mockUseAuth.mockReturnValue({ ...DEFAULT_AUTH, isAuthenticated: false, isLoading: false });
      const { container } = render(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>
      );
      // No debe contener el children ni el sidebar
      expect(container.innerHTML).toBe('');
    });
  });

  // ─── Non-GESTION role redirect (BUG-2: whitelist !== GESTION) ─────

  describe('Non-GESTION role redirect (whitelist fix)', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...OLD_ENV };
    });

    afterEach(() => {
      process.env = OLD_ENV;
    });

    it('redirige a tiza-web cuando el rol es TEACHER', () => {
      const originalLocation = window.location;
      // @ts-ignore
      delete window.location;
      // @ts-ignore
      window.location = { ...originalLocation, href: '' };

      mockUseAuth.mockReturnValue({
        ...DEFAULT_AUTH,
        user: { ...DEFAULT_AUTH.user, role: 'TEACHER' },
      });

      renderLayout();

      expect(window.location.href).toContain('localhost:3001/dashboard');
    });

    it('NO redirige a tiza-web para rol ADMIN (ADMIN ahora puede usar el dashboard)', () => {
      mockUseAuth.mockReturnValue({
        ...DEFAULT_AUTH,
        user: { ...DEFAULT_AUTH.user, role: 'ADMIN' },
      });

      renderLayout();

      // ADMIN should NOT be redirected — stays on relevo dashboard
      expect(mockPush).not.toHaveBeenCalledWith('/login');
      // ADMIN should see the dashboard (like GESTION) + admin-only nav items
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      // 'Pendientes' page was removed — anchor assertion was removed accordingly
    });

    it('redirige a tiza-web para rol SUPERVISOR (también !== GESTION)', () => {
      const originalLocation = window.location;
      // @ts-ignore
      delete window.location;
      // @ts-ignore
      window.location = { ...originalLocation, href: '' };

      mockUseAuth.mockReturnValue({
        ...DEFAULT_AUTH,
        user: { ...DEFAULT_AUTH.user, role: 'SUPERVISOR' },
      });

      renderLayout();

      expect(window.location.href).toContain('http://localhost:3001/dashboard');
    });

    it('usa NEXT_PUBLIC_TIZA_URL si está definida', () => {
      const originalLocation = window.location;
      // @ts-ignore
      delete window.location;
      // @ts-ignore
      window.location = { ...originalLocation, href: '' };

      process.env.NEXT_PUBLIC_TIZA_URL = 'https://tiza.pro';
      mockUseAuth.mockReturnValue({
        ...DEFAULT_AUTH,
        user: { ...DEFAULT_AUTH.user, role: 'TEACHER' },
      });

      renderLayout();

      expect(window.location.href).toContain('https://tiza.pro/dashboard');
    });

    it('redirige preservando el pathname actual (BUG-3: ${tizaUrl}${pathname})', () => {
      const originalLocation = window.location;
      // @ts-ignore
      delete window.location;
      // @ts-ignore
      window.location = { ...originalLocation, href: '' };

      mockPathname.mockReturnValue('/dashboard/colegios');
      mockUseAuth.mockReturnValue({
        ...DEFAULT_AUTH,
        user: { ...DEFAULT_AUTH.user, role: 'TEACHER' },
      });

      renderLayout();

      expect(window.location.href).toContain('http://localhost:3001/dashboard/colegios');
    });

    it('NO redirige a tiza-web si el rol es GESTION', () => {
      const originalLocation = window.location;
      // @ts-ignore
      delete window.location;
      // @ts-ignore
      window.location = { ...originalLocation, href: '' };

      mockUseAuth.mockReturnValue({ ...DEFAULT_AUTH });

      renderLayout();

      expect(window.location.href).not.toContain('tiza');
    });

    it('NO redirige si user es null (edge case: sesión corrupta)', () => {
      const originalLocation = window.location;
      // @ts-ignore
      delete window.location;
      // @ts-ignore
      window.location = { ...originalLocation, href: '' };

      mockUseAuth.mockReturnValue({
        ...DEFAULT_AUTH,
        user: null,
        isAuthenticated: false,
      });

      renderLayout();

      // Con user null y isAuthenticated false: debe redirigir a /login, no a tiza
      expect(mockPush).toHaveBeenCalledWith('/login');
      expect(window.location.href).not.toContain('tiza');
    });
  });

  // ─── Early return: prevención de content flash (BUG-1) ────────

  describe('Early return — Redirigiendo... (BUG-1)', () => {
    it('muestra "Redirigiendo..." cuando el rol no es GESTION (previene content flash)', () => {
      mockUseAuth.mockReturnValue({
        ...DEFAULT_AUTH,
        user: { ...DEFAULT_AUTH.user, role: 'TEACHER' },
      });

      renderLayout();
      expect(screen.getByText('Redirigiendo...')).toBeInTheDocument();
      expect(screen.getByText('No tienes acceso a esta aplicación')).toBeInTheDocument();
    });

    it('NO muestra "Redirigiendo..." para rol ADMIN (ADMIN ahora puede usar el dashboard)', () => {
      mockUseAuth.mockReturnValue({
        ...DEFAULT_AUTH,
        user: { ...DEFAULT_AUTH.user, role: 'ADMIN' },
      });

      renderLayout();
      expect(screen.queryByText('Redirigiendo...')).not.toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('NO muestra "Redirigiendo..." para rol GESTION', () => {
      renderLayout();
      expect(screen.queryByText('Redirigiendo...')).not.toBeInTheDocument();
      expect(screen.queryByText('No tienes acceso a esta aplicación')).not.toBeInTheDocument();
    });

    it('NO muestra "Redirigiendo..." cuando isLoading es true (incluso para TEACHER)', () => {
      mockUseAuth.mockReturnValue({
        ...DEFAULT_AUTH,
        isLoading: true,
        isAuthenticated: false,
        user: null,
      });

      renderLayout();
      // Mientras carga, debe mostrar "Cargando..." no "Redirigiendo..."
      expect(screen.getByText('Cargando...')).toBeInTheDocument();
      expect(screen.queryByText('Redirigiendo...')).not.toBeInTheDocument();
    });

    it('NO muestra "Redirigiendo..." cuando no está autenticado (retorna null)', () => {
      mockUseAuth.mockReturnValue({
        ...DEFAULT_AUTH,
        isAuthenticated: false,
        user: null,
      });

      renderLayout();
      expect(screen.queryByText('Redirigiendo...')).not.toBeInTheDocument();
      expect(screen.queryByText('No tienes acceso a esta aplicación')).not.toBeInTheDocument();
    });
  });

  // ─── GESTION can view dashboard ──────────────────────────────────

  describe('GESTION access', () => {
    it('renderiza los elementos de navegación para GESTION', () => {
      renderLayout();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Colegios')).toBeInTheDocument();
      expect(screen.getByText('Analítica')).toBeInTheDocument();
      expect(screen.getByText('Usuarios')).toBeInTheDocument();
      expect(screen.getByText('Facturación')).toBeInTheDocument();
    });

    it('muestra el nombre del usuario en el sidebar', () => {
      renderLayout();
      expect(screen.getByText('Director Test')).toBeInTheDocument();
    });

    it('muestra el email del usuario en el sidebar', () => {
      renderLayout();
      expect(screen.getByText('director@colegio.cl')).toBeInTheDocument();
    });

    it('renderiza el contenido hijo en el main', () => {
      renderLayout();
      expect(screen.getByTestId('children-content')).toBeInTheDocument();
      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
    });
  });

  // ─── Active nav item (exact match) ──────────────────────────────

  describe('Active nav item — exact match', () => {
    it('resalta Dashboard cuando pathname es /dashboard', () => {
      mockPathname.mockReturnValue('/dashboard');
      renderLayout();

      const dashboardLink = screen.getByText('Dashboard').closest('a');
      expect(dashboardLink?.className).toContain('bg-brand-primary text-white');
    });

    it('resalta Colegios cuando pathname es /dashboard/colegios', () => {
      mockPathname.mockReturnValue('/dashboard/colegios');
      renderLayout();

      const colegiosLink = screen.getByText('Colegios').closest('a');
      expect(colegiosLink?.className).toContain('bg-brand-primary text-white');

      // Dashboard no debe estar activo
      const dashboardLink = screen.getByText('Dashboard').closest('a');
      expect(dashboardLink?.className).not.toContain('bg-brand-primary');
    });

    it('resalta Analítica cuando pathname es /dashboard/analitica', () => {
      mockPathname.mockReturnValue('/dashboard/analitica');
      renderLayout();

      const analiticaLink = screen.getByText('Analítica').closest('a');
      expect(analiticaLink?.className).toContain('bg-brand-primary text-white');
    });

    it('resalta Usuarios cuando pathname es /dashboard/usuarios', () => {
      mockPathname.mockReturnValue('/dashboard/usuarios');
      renderLayout();

      const usuariosLink = screen.getByText('Usuarios').closest('a');
      expect(usuariosLink?.className).toContain('bg-brand-primary text-white');
    });

    it('resalta Facturación cuando pathname es /dashboard/facturacion', () => {
      mockPathname.mockReturnValue('/dashboard/facturacion');
      renderLayout();

      const facturacionLink = screen.getByText('Facturación').closest('a');
      expect(facturacionLink?.className).toContain('bg-brand-primary text-white');
    });

    it('NO resalta múltiples items (bug de doble resaltado eliminado)', () => {
      // Si pathname es /dashboard/colegios, solo colegios debe estar activo
      mockPathname.mockReturnValue('/dashboard/colegios');
      renderLayout();

      const links = screen.getAllByRole('link');
      const activeLinks = links.filter(
        (link) =>
          link.className.includes('bg-brand-primary') && link.className.includes('text-white')
      );
      expect(activeLinks).toHaveLength(1);
    });

    it('no resalta ningún item para rutas fuera del sidebar', () => {
      mockPathname.mockReturnValue('/some-other-page');
      renderLayout();

      const links = screen.getAllByRole('link');
      const activeLinks = links.filter((link) => link.className.includes('bg-brand-primary'));
      expect(activeLinks).toHaveLength(0);
    });
  });

  // ─── HTML entities ──────────────────────────────────────────────

  describe('Labels — sin HTML entities crudas', () => {
    it('muestra "Analítica" sin HTML entities', () => {
      renderLayout();
      const analitica = screen.getByText('Analítica');
      expect(analitica).toBeInTheDocument();
      expect(analitica.innerHTML).not.toContain('&iacute;');
      expect(analitica.innerHTML).not.toContain('&#237;');
    });

    it('muestra "Facturación" sin HTML entities', () => {
      renderLayout();
      const facturacion = screen.getByText('Facturación');
      expect(facturacion).toBeInTheDocument();
      expect(facturacion.innerHTML).not.toContain('&oacute;');
      expect(facturacion.innerHTML).not.toContain('&#243;');
    });

    it('muestra "Cerrar sesión" sin HTML entities', () => {
      renderLayout();
      const cerrar = screen.getByText('Cerrar sesión');
      expect(cerrar).toBeInTheDocument();
      expect(cerrar.innerHTML).not.toContain('&oacute;');
    });
  });

  // ─── Logout ─────────────────────────────────────────────────────

  describe('Logout', () => {
    it('llama logout() al hacer click en "Cerrar sesión"', async () => {
      renderLayout();
      const user = userEvent.setup();
      const logoutButton = screen.getByText('Cerrar sesión');

      // El botón de logout está dentro de un <button> con onClick
      // pero puede que sea más de un elemento con "Cerrar sesión"
      // Buscamos el button específicamente
      const button = logoutButton.closest('button');
      expect(button).not.toBeNull();

      await user.click(button!);
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Tenant selector ───────────────────────────────────────────

  describe('Tenant selector', () => {
    it('se muestra cuando multiSchool feature flag está activo', () => {
      mockUseFeatures.mockReturnValue({
        ...DEFAULT_FEATURES,
        features: { multiSchool: true },
      });
      renderLayout();
      expect(screen.getByLabelText('Seleccionar colegio activo')).toBeInTheDocument();
    });

    it('NO se muestra cuando multiSchool feature flag está inactivo', () => {
      mockUseFeatures.mockReturnValue({
        ...DEFAULT_FEATURES,
        features: { multiSchool: false },
      });
      renderLayout();
      expect(screen.queryByLabelText('Seleccionar colegio activo')).not.toBeInTheDocument();
    });

    it('NO se muestra cuando features no han cargado', () => {
      mockUseFeatures.mockReturnValue({
        ...DEFAULT_FEATURES,
        isLoaded: false,
        features: {},
      });
      renderLayout();
      expect(screen.queryByLabelText('Seleccionar colegio activo')).not.toBeInTheDocument();
    });

    it('persiste el tenant seleccionado en localStorage', async () => {
      mockUseFeatures.mockReturnValue({
        ...DEFAULT_FEATURES,
        features: { multiSchool: true },
      });
      renderLayout();

      const user = userEvent.setup();
      const select = screen.getByLabelText('Seleccionar colegio activo');
      await user.selectOptions(select, 't3');

      expect(localStorage.setItem).toHaveBeenCalledWith('relevo-active-tenant', 't3');
    });

    it('inicializa desde tenant guardado en localStorage si es válido (cubre línea init)', () => {
      // Pre-poblar localStorage con un tenant antes del render
      localStorageStore['relevo-active-tenant'] = 't5';
      mockUseActiveTenant.mockReturnValue({
        ...DEFAULT_ACTIVE_TENANT,
        activeTenantId: 't5',
        activeTenant: MOCK_TENANTS[4], // "Colegio Santa María"
      });
      mockUseFeatures.mockReturnValue({
        ...DEFAULT_FEATURES,
        features: { multiSchool: true },
      });
      renderLayout();

      // El selector debe mostrar "Colegio Santa María" (t5) como seleccionado
      const select = screen.getByLabelText('Seleccionar colegio activo') as HTMLSelectElement;
      expect(select.value).toBe('t5');
    });

    it('usa tenant default cuando el stored tenant no es válido (cubre else-if branch)', () => {
      // Pre-poblar con un tenant ID inválido — el contexto retorna el default (t1)
      localStorageStore['relevo-active-tenant'] = 'invalid-tenant-id';
      mockUseActiveTenant.mockReturnValue({
        ...DEFAULT_ACTIVE_TENANT,
        activeTenantId: 't1',
        activeTenant: MOCK_TENANTS[0], // "Colegio San Miguel"
      });
      mockUseFeatures.mockReturnValue({
        ...DEFAULT_FEATURES,
        features: { multiSchool: true },
      });
      renderLayout();

      // Debe elegir el primer tenant como default
      const select = screen.getByLabelText('Seleccionar colegio activo') as HTMLSelectElement;
      expect(select.value).toBe('t1');
    });
  });

  // ─── Mobile responsive ─────────────────────────────────────────

  describe('Mobile responsive', () => {
    it('renderiza el botón hamburguesa para abrir menú', () => {
      renderLayout();
      const menuButton = screen.getByLabelText('Abrir menú');
      expect(menuButton).toBeInTheDocument();
    });

    it('cambia el aria-label del botón cuando el sidebar está abierto', async () => {
      renderLayout();
      const user = userEvent.setup();

      const menuButton = screen.getByLabelText('Abrir menú');
      await user.click(menuButton);

      expect(screen.getByLabelText('Cerrar menú')).toBeInTheDocument();
    });

    it('cierra el sidebar al hacer click en un nav link', async () => {
      renderLayout();
      const user = userEvent.setup();

      // Abrir sidebar primero
      const menuButton = screen.getByLabelText('Abrir menú');
      await user.click(menuButton);

      // Click en un nav link
      const dashboardLink = screen.getByText('Dashboard').closest('a')!;
      await user.click(dashboardLink);

      // El sidebar debe cerrarse (aria-label vuelve a "Abrir menú")
      expect(screen.getByLabelText('Abrir menú')).toBeInTheDocument();
    });

    it('cierra el sidebar al hacer click en el backdrop overlay (cubre onClick del backdrop)', async () => {
      renderLayout();
      const user = userEvent.setup();

      // Abrir sidebar primero
      const menuButton = screen.getByLabelText('Abrir menú');
      await user.click(menuButton);

      // Verificar que el backdrop está presente
      const backdrop = document.querySelector('[aria-hidden="true"]');
      expect(backdrop).toBeInTheDocument();

      // Hacer click en el backdrop overlay para cerrar
      await user.click(backdrop!);

      // El sidebar debe cerrarse (aria-label vuelve a "Abrir menú")
      expect(screen.getByLabelText('Abrir menú')).toBeInTheDocument();
    });
  });

  // ─── Brand/release info ─────────────────────────────────────────

  describe('UI/UX elements', () => {
    it('muestra "RELEVO" y "Datos que transforman" en el sidebar', () => {
      renderLayout();
      expect(screen.getByText('RELEVO')).toBeInTheDocument();
      expect(screen.getByText('Datos que transforman')).toBeInTheDocument();
    });

    it('muestra la inicial del nombre del usuario en el avatar', () => {
      renderLayout();
      // Avatar con la inicial D de "Director Test"
      expect(screen.getByText('D')).toBeInTheDocument();
    });

    it('muestra "D" y "Director" como fallbacks cuando user.name es null', () => {
      mockUseAuth.mockReturnValue({
        ...DEFAULT_AUTH,
        user: { ...DEFAULT_AUTH.user, name: null },
      });
      renderLayout();

      // Fallback de inicial: user?.name?.[0] || 'D'
      expect(screen.getByText('D')).toBeInTheDocument();
      // Fallback de nombre: user?.name || 'Director'
      expect(screen.getByText('Director')).toBeInTheDocument();
    });

    it('muestra "D" y "Director" como fallbacks cuando user.name es undefined', () => {
      mockUseAuth.mockReturnValue({
        ...DEFAULT_AUTH,
        user: { ...DEFAULT_AUTH.user, name: undefined },
      });
      renderLayout();

      expect(screen.getByText('D')).toBeInTheDocument();
      expect(screen.getByText('Director')).toBeInTheDocument();
    });
  });
});
