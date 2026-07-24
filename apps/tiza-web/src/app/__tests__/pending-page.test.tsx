import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ──────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockFetchToken = vi.fn();
const mockGetStoredUser = vi.fn();
vi.mock('@/lib/auth', () => ({
  fetchTokenFromSession: (...args: any[]) => mockFetchToken(...args),
  getStoredUser: (...args: any[]) => mockGetStoredUser(...args),
}));

vi.mock('@tiza/ui', () => ({
  Spinner: ({ size }: any) => <div data-testid="spinner" data-size={size} />,
  Button: ({ children, onClick, ...rest }: any) => (
    <button onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  ErrorMessage: ({ message, variant }: any) => (
    <div role="alert" data-variant={variant}>
      {message}
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  Clock: (props: any) => <svg data-testid="icon-clock" {...props} />,
  CheckCircle2: (props: any) => <svg data-testid="icon-check" {...props} />,
  Hourglass: (props: any) => <svg data-testid="icon-hourglass" {...props} />,
}));

// ─── Module under test ─────────────────────────────────────

async function getModule() {
  return await import('../(auth)/pending/page');
}

// ─── Helpers ────────────────────────────────────────────────

async function renderPendingPage() {
  const { default: PendingPage } = await getModule();
  return render(<PendingPage />);
}

// ─── Tests ──────────────────────────────────────────────────

describe('PendingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra el estado de carga inicialmente', async () => {
    // Don't resolve fetchTokenFromSession — keep loading
    mockFetchToken.mockReturnValue(new Promise(() => {}));
    mockGetStoredUser.mockReturnValue(null);

    await renderPendingPage();

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    expect(screen.getByText('Verificando estado de tu solicitud...')).toBeInTheDocument();
  });

  it('muestra estado pendiente cuando no hay token', async () => {
    mockFetchToken.mockResolvedValue(null);
    mockGetStoredUser.mockReturnValue(null);

    await renderPendingPage();

    await waitFor(() => {
      expect(screen.getByText('Solicitud Enviada')).toBeInTheDocument();
    });

    // Verify stepper is shown
    expect(screen.getByRole('list', { name: 'Progreso de la solicitud' })).toBeInTheDocument();
    expect(screen.getByText('Solicitud enviada')).toBeInTheDocument();
    expect(screen.getByText('En revisión')).toBeInTheDocument();
    expect(screen.getByText('Aprobación')).toBeInTheDocument();
  });

  it('muestra estado pendiente cuando el usuario está en estado "pending"', async () => {
    mockFetchToken.mockResolvedValue('some-token');
    mockGetStoredUser.mockReturnValue({
      id: '1',
      email: 'teacher@test.cl',
      name: 'Teacher',
      role: 'teacher',
      status: 'pending',
      tenantId: 'tenant-1',
    });

    await renderPendingPage();

    await waitFor(() => {
      expect(screen.getByText('Solicitud Enviada')).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('redirige a /dashboard cuando el usuario está activo', async () => {
    mockFetchToken.mockResolvedValue('valid-token');
    mockGetStoredUser.mockReturnValue({
      id: '1',
      email: 'teacher@test.cl',
      name: 'Teacher',
      role: 'teacher',
      status: 'active',
      tenantId: 'tenant-1',
    });

    await renderPendingPage();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('muestra estado de error cuando fetchTokenFromSession lanza una excepción', async () => {
    mockFetchToken.mockRejectedValue(new Error('Network error'));
    mockGetStoredUser.mockReturnValue(null);

    await renderPendingPage();

    await waitFor(() => {
      expect(screen.getByText('Error de verificación')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Error al verificar el estado de tu solicitud. Intenta de nuevo.')
    ).toBeInTheDocument();
  });

  it('el estado de error tiene botón de reintentar que recarga la página', async () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadSpy },
      writable: true,
    });

    mockFetchToken.mockRejectedValue(new Error('Network error'));
    mockGetStoredUser.mockReturnValue(null);

    await renderPendingPage();

    await waitFor(() => {
      expect(screen.getByText('Error de verificación')).toBeInTheDocument();
    });

    const retryButton = screen.getByText('Reintentar');
    await userEvent.click(retryButton);

    expect(reloadSpy).toHaveBeenCalled();
  });
});
