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

// Mock auth helpers directly — we'll control them per test
const mockFetchTokenFromSession = vi.fn();
const mockGetStoredUser = vi.fn();
vi.mock('@/lib/auth', () => ({
  fetchTokenFromSession: (...args: any[]) => mockFetchTokenFromSession(...args),
  getStoredUser: (...args: any[]) => mockGetStoredUser(...args),
}));

vi.mock('@tiza/ui', () => ({
  Button: ({ children, onClick, variant, brand: _brand, className, ...rest }: any) => (
    <button onClick={onClick} className={className} {...rest}>
      {children}
    </button>
  ),
  Card: ({ children }: any) => <div>{children}</div>,
  Spinner: ({ size }: any) => <div data-testid="spinner" data-size={size} />,
  ErrorMessage: ({ message, variant }: any) => (
    <div role="alert" data-variant={variant}>
      {message}
    </div>
  ),
}));

// ─── Module under test ─────────────────────────────────────

async function getModule() {
  return await import('../page');
}

// ─── Tests ──────────────────────────────────────────────────

describe('PendingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra estado loading inicialmente', async () => {
    // Don't resolve — keep loading
    mockFetchTokenFromSession.mockReturnValueOnce(new Promise(() => {}));

    const { default: PendingPage } = await getModule();
    render(<PendingPage />);

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    expect(screen.getByText('Verificando estado de tu solicitud...')).toBeInTheDocument();
  });

  it('redirige a /dashboard si el usuario ya está activo', async () => {
    mockFetchTokenFromSession.mockResolvedValue('token-123');
    mockGetStoredUser.mockReturnValue({
      id: '1',
      email: 'test@test.com',
      name: 'Test',
      role: 'HOLDER',
      status: 'active',
      tenantId: 't1',
    });

    const { default: PendingPage } = await getModule();
    render(<PendingPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('muestra estado "pending" cuando no hay token', async () => {
    mockFetchTokenFromSession.mockResolvedValue(null);
    mockGetStoredUser.mockReturnValue(null);

    const { default: PendingPage } = await getModule();
    render(<PendingPage />);

    await waitFor(() => {
      expect(screen.getByText('Solicitud Enviada')).toBeInTheDocument();
    });
    expect(screen.getByText('En revisión')).toBeInTheDocument();
    expect(screen.getByText('Volver al inicio')).toBeInTheDocument();
  });

  it('muestra estado "pending" cuando el usuario está pendiente', async () => {
    mockFetchTokenFromSession.mockResolvedValue('token-123');
    mockGetStoredUser.mockReturnValue({
      id: '1',
      email: 'pending@test.com',
      name: 'Pending',
      role: 'HOLDER',
      status: 'pending',
      tenantId: 't1',
    });

    const { default: PendingPage } = await getModule();
    render(<PendingPage />);

    await waitFor(() => {
      expect(screen.getByText('Solicitud Enviada')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('muestra estado de error cuando fetchTokenFromSession lanza error', async () => {
    mockFetchTokenFromSession.mockRejectedValue(new Error('Network error'));

    const { default: PendingPage } = await getModule();
    render(<PendingPage />);

    await waitFor(() => {
      expect(screen.getByText('Error de verificación')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Error al verificar el estado de tu solicitud. Intenta de nuevo.')
    ).toBeInTheDocument();
  });

  it('tiene botón "Reintentar" en estado de error que recarga la página', async () => {
    const originalLocation = window.location;
    // @ts-ignore
    delete window.location;
    // @ts-ignore
    window.location = { ...originalLocation, reload: vi.fn() };

    mockFetchTokenFromSession.mockRejectedValue(new Error('Network error'));

    const { default: PendingPage } = await getModule();
    render(<PendingPage />);

    await waitFor(() => {
      expect(screen.getByText('Reintentar')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Reintentar'));
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it('muestra el stepper de progreso con 3 pasos en estado pending', async () => {
    mockFetchTokenFromSession.mockResolvedValue(null);
    mockGetStoredUser.mockReturnValue(null);

    const { default: PendingPage } = await getModule();
    render(<PendingPage />);

    await waitFor(() => {
      expect(screen.getByText('Solicitud Enviada')).toBeInTheDocument();
    });

    expect(screen.getByText('Solicitud enviada')).toBeInTheDocument();
    expect(screen.getByText('En revisión')).toBeInTheDocument();
    expect(screen.getByText('Aprobación')).toBeInTheDocument();
  });
});
