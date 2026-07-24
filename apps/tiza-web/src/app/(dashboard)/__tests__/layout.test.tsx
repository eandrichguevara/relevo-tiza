import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ──────────────────────────────────────────────────

const mockPush = vi.fn();
const mockPathname = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, onClick, ...rest }: any) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}));

const mockLogout = vi.fn();
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: (...args: any[]) => mockUseAuth(...args),
}));

const mockUseAppStore = vi.fn();
vi.mock('@/store/useAppStore', () => ({
  useAppStore: (...args: any[]) => mockUseAppStore(...args),
}));

const mockUseFeatures = vi.fn();
vi.mock('@/hooks/useFeatures', () => ({
  useFeatures: (...args: any[]) => mockUseFeatures(...args),
}));

const mockUsePendingReviews = vi.fn();
vi.mock('@/hooks/useApi', () => ({
  usePendingReviews: (...args: any[]) => mockUsePendingReviews(...args),
}));

const mockUser = {
  name: 'Profesor Test',
  email: 'test@colegio.cl',
};

function setDefaultMocks() {
  mockUseAuth.mockReturnValue({
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
    logout: mockLogout,
  });
  mockUseAppStore.mockReturnValue({
    sidebarOpen: false,
    toggleSidebar: vi.fn(),
    setSidebarOpen: vi.fn(),
  });
  mockUseFeatures.mockReturnValue({
    features: { billing: false },
    isLoaded: true,
  });
  mockUsePendingReviews.mockReturnValue({
    data: [],
  });
  mockPathname.mockReturnValue('/dashboard');
}

async function getModule() {
  return await import('../layout');
}

async function renderDashboardLayout() {
  const { default: DashboardLayout } = await getModule();
  return render(
    <DashboardLayout>
      <div data-testid="page-content">Content</div>
    </DashboardLayout>
  );
}

// ─── Tests ──────────────────────────────────────────────────

describe('DashboardLayout (Tiza)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultMocks();
  });

  it('muestra loading mientras isLoading es true', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      logout: mockLogout,
    });

    await renderDashboardLayout();

    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it('no renderiza contenido cuando no está autenticado', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      logout: mockLogout,
    });

    await renderDashboardLayout();

    expect(screen.queryByTestId('page-content')).not.toBeInTheDocument();
    expect(screen.queryByText('TIZA')).not.toBeInTheDocument();
  });

  it('redirige a /login cuando no está autenticado', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      logout: mockLogout,
    });

    await renderDashboardLayout();

    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('renderiza sidebar con enlaces de navegación cuando está autenticado', async () => {
    await renderDashboardLayout();

    expect(screen.getByText('TIZA')).toBeInTheDocument();
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.getByText('Cursos')).toBeInTheDocument();
    expect(screen.getByText('Evaluaciones')).toBeInTheDocument();
    expect(screen.getByText('Revisar')).toBeInTheDocument();
    expect(screen.getByText('Reportes')).toBeInTheDocument();
  });

  it('renderiza el contenido principal', async () => {
    await renderDashboardLayout();

    expect(screen.getByTestId('page-content')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('muestra el nombre y email del usuario en el sidebar', async () => {
    await renderDashboardLayout();

    expect(screen.getByText('Profesor Test')).toBeInTheDocument();
    expect(screen.getByText('test@colegio.cl')).toBeInTheDocument();
  });

  it('tiene botón de cerrar sesión que llama a logout', async () => {
    await renderDashboardLayout();

    const logoutBtn = screen.getByText('Cerrar sesión');
    await userEvent.click(logoutBtn);

    expect(mockLogout).toHaveBeenCalled();
  });

  it('no muestra enlace de Facturación cuando billing feature está desactivado', async () => {
    mockUseFeatures.mockReturnValue({
      features: { billing: false },
      isLoaded: true,
    });

    await renderDashboardLayout();

    expect(screen.queryByText('Facturación')).not.toBeInTheDocument();
  });

  it('muestra enlace de Facturación cuando billing feature está activo', async () => {
    mockUseFeatures.mockReturnValue({
      features: { billing: true },
      isLoaded: true,
    });

    await renderDashboardLayout();

    expect(screen.getByText('Facturación')).toBeInTheDocument();
  });

  it('muestra badge con contador de revisiones en el nav', async () => {
    mockUsePendingReviews.mockReturnValue({
      data: [{ id: 'pr1' }, { id: 'pr2' }, { id: 'pr3' }],
    });

    await renderDashboardLayout();

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByLabelText('3 evaluaciones pendientes de revisión')).toBeInTheDocument();
  });

  it('muestra 9+ cuando hay más de 9 pendientes', async () => {
    mockUsePendingReviews.mockReturnValue({
      data: Array(15).fill({ id: 'pr' }),
    });

    await renderDashboardLayout();

    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('marca el enlace activo con la clase bg-brand-primary', async () => {
    mockPathname.mockReturnValue('/dashboard/cursos');

    await renderDashboardLayout();

    // The active link should have the special styling
    const links = screen.getAllByRole('link');
    const activeLink = links.find((link) => link.getAttribute('href') === '/dashboard/cursos');
    expect(activeLink).toBeInTheDocument();
  });

  it('tiene botón de menú hamburguesa para mobile', async () => {
    await renderDashboardLayout();

    const menuBtn = screen.getByLabelText('Abrir menú');
    expect(menuBtn).toBeInTheDocument();
  });

  it('toggleSidebar se llama al hacer clic en hamburguesa', async () => {
    const mockToggle = vi.fn();
    mockUseAppStore.mockReturnValue({
      sidebarOpen: false,
      toggleSidebar: mockToggle,
      setSidebarOpen: vi.fn(),
    });

    await renderDashboardLayout();

    const menuBtn = screen.getByLabelText('Abrir menú');
    await userEvent.click(menuBtn);

    expect(mockToggle).toHaveBeenCalled();
  });

  it('muestra el badge de Revisar solo cuando hay al menos 1 pendiente', async () => {
    mockUsePendingReviews.mockReturnValue({
      data: [],
    });

    await renderDashboardLayout();

    // No badge should be visible
    const revisarLink = screen.getByText('Revisar').closest('a');
    expect(revisarLink).toBeInTheDocument();
    // The badge container should not exist
    expect(screen.queryByLabelText(/evaluaciones pendientes/)).not.toBeInTheDocument();
  });

  it('renderiza correctamente con features isLoaded=false', async () => {
    mockUseFeatures.mockReturnValue({
      features: {},
      isLoaded: false,
    });

    await renderDashboardLayout();

    // Navigation items should still render (billing is not included since isLoaded=false)
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.queryByText('Facturación')).not.toBeInTheDocument();
  });
});
