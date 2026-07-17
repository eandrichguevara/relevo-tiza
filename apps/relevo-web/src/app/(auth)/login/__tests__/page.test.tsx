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

const mockLogin = vi.fn();
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: (...args: any[]) => mockUseAuth(...args),
}));

vi.mock('@tiza/ui', () => ({
  Input: ({ label, error, ...rest }: any) => (
    <div>
      <label>
        {label}
        <input {...rest} aria-label={label} data-error={error || ''} />
      </label>
      {error && <span role="alert">{error}</span>}
    </div>
  ),
  Button: ({ children, loading, disabled, ...rest }: any) => (
    <button disabled={disabled || loading} {...rest}>
      {loading ? 'Ingresando...' : children}
    </button>
  ),
  ErrorMessage: ({ message, variant, onDismiss }: any) => (
    <div role="alert" data-variant={variant}>
      {message}
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Cerrar error">
          ×
        </button>
      )}
    </div>
  ),
}));

// ─── Module under test ─────────────────────────────────────

async function getModule() {
  return await import('../page');
}

// ─── Helpers ────────────────────────────────────────────────

async function renderLoginPage() {
  const { default: LoginPage } = await getModule();
  return render(<LoginPage />);
}

async function fillLoginForm(email: string, password: string) {
  await userEvent.type(screen.getByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Contraseña'), password);
}

// ─── Tests ──────────────────────────────────────────────────

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      login: mockLogin,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('renderiza el formulario de acceso', async () => {
    await renderLoginPage();

    expect(screen.getByText('Acceso RELEVO')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByText('Ingresar')).toBeInTheDocument();
    expect(screen.getByText('Solicitar demo')).toBeInTheDocument();
  });

  it('tiene el aria-label "Formulario de acceso"', async () => {
    await renderLoginPage();
    expect(screen.getByLabelText('Formulario de acceso')).toBeInTheDocument();
  });

  it('redirige a /dashboard en login exitoso', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    await renderLoginPage();

    await fillLoginForm('director@colegio.cl', 'password123');
    await userEvent.click(screen.getByText('Ingresar'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('director@colegio.cl', 'password123');
    });
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('muestra error de validación para email inválido', async () => {
    await renderLoginPage();

    await fillLoginForm('invalido', 'password123');
    await userEvent.click(screen.getByText('Ingresar'));

    expect(screen.getByText('Formato de email inválido')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('muestra error de validación para contraseña corta', async () => {
    await renderLoginPage();

    await fillLoginForm('director@colegio.cl', '1234567');
    await userEvent.click(screen.getByText('Ingresar'));

    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('muestra mensaje genérico en error 401', async () => {
    const apiError = {
      status: 401,
      detail: 'Invalid credentials',
      translatedMessage: 'No autorizado',
    };
    mockLogin.mockRejectedValueOnce(apiError);
    await renderLoginPage();

    await fillLoginForm('test@test.com', 'password123');
    await userEvent.click(screen.getByText('Ingresar'));

    await waitFor(() => {
      expect(
        screen.getByText('Credenciales incorrectas. Verifica tu email y contraseña.')
      ).toBeInTheDocument();
    });
  });

  it('muestra mensaje de cuenta pendiente en error 403', async () => {
    const apiError = {
      status: 403,
      detail: 'Cuenta pendiente de aprobación',
      translatedMessage: 'Acceso denegado',
    };
    mockLogin.mockRejectedValueOnce(apiError);
    await renderLoginPage();

    await fillLoginForm('pending@test.com', 'password123');
    await userEvent.click(screen.getByText('Ingresar'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Tu cuenta está pendiente de aprobación. Te notificaremos por correo cuando sea aprobada.'
        )
      ).toBeInTheDocument();
    });
  });

  it('muestra mensaje de rechazo en error 403 con "rechaz"', async () => {
    const apiError = {
      status: 403,
      detail: 'Solicitud rechazada',
      translatedMessage: 'Acceso denegado',
    };
    mockLogin.mockRejectedValueOnce(apiError);
    await renderLoginPage();

    await fillLoginForm('rejected@test.com', 'password123');
    await userEvent.click(screen.getByText('Ingresar'));

    await waitFor(() => {
      expect(
        screen.getByText('Tu solicitud fue rechazada. Contacta al administrador.')
      ).toBeInTheDocument();
    });
  });

  it('muestra translatedMessage cuando no es 401 ni 403', async () => {
    const apiError = {
      status: 500,
      detail: 'Server error',
      translatedMessage: 'Error interno del servidor.',
    };
    mockLogin.mockRejectedValueOnce(apiError);
    await renderLoginPage();

    await fillLoginForm('test@test.com', 'password123');
    await userEvent.click(screen.getByText('Ingresar'));

    await waitFor(() => {
      expect(screen.getByText('Error interno del servidor.')).toBeInTheDocument();
    });
  });

  it('limpia el error general al hacer dismiss', async () => {
    const apiError = { status: 401, detail: 'Invalid', translatedMessage: 'No autorizado' };
    mockLogin.mockRejectedValueOnce(apiError);
    await renderLoginPage();

    await fillLoginForm('test@test.com', 'password123');
    await userEvent.click(screen.getByText('Ingresar'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const dismissBtn = screen.getByLabelText('Cerrar error');
    await userEvent.click(dismissBtn);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
