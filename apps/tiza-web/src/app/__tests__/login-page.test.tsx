import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ──────────────────────────────────────────────────

const mockPush = vi.fn();
let searchParamsMap: Record<string, string> = {};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: (key: string) => searchParamsMap[key] ?? null,
  }),
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
  Input: ({ label, error, onChange, value, ...rest }: any) => (
    <div>
      <label>
        {label}
        <input
          {...rest}
          value={value}
          onChange={onChange}
          aria-label={label}
          data-error={error || ''}
        />
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
  return await import('../(auth)/login/page');
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

describe('LoginPage (Tiza)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsMap = {};
    mockUseAuth.mockReturnValue({
      login: mockLogin,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('renderiza el formulario de inicio de sesión con todos los elementos', async () => {
    await renderLoginPage();

    expect(screen.getByText('Iniciar sesión')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    expect(screen.getByText('Regístrate gratis')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Regístrate gratis' })).toHaveAttribute(
      'href',
      '/register'
    );
  });

  it('tiene el aria-label correcto en el formulario', async () => {
    await renderLoginPage();

    expect(
      screen.getByLabelText('Formulario de inicio de sesión')
    ).toBeInTheDocument();
  });

  it('muestra error de validación para email inválido y no envía el formulario', async () => {
    await renderLoginPage();

    await fillLoginForm('invalido', 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(screen.getByText('Formato de email inválido')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('muestra error de validación para contraseña corta y no envía el formulario', async () => {
    await renderLoginPage();

    await fillLoginForm('test@test.com', '1234567');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(
      screen.getByText('La contraseña debe tener al menos 8 caracteres')
    ).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('redirige a /dashboard mediante window.location.href en login exitoso', async () => {
    // Mock window.location.href to intercept the redirect
    delete (window as any).location;
    window.location = { href: '' } as Location;

    mockLogin.mockResolvedValueOnce(undefined);
    await renderLoginPage();

    await fillLoginForm('teacher@colegio.cl', 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('teacher@colegio.cl', 'password123');
    });
    expect(window.location.href).toBe('/dashboard');
  });

  it('muestra mensaje de error genérico en error 401', async () => {
    const apiError = {
      status: 401,
      detail: 'Invalid credentials',
      translatedMessage: 'No autorizado',
    };
    mockLogin.mockRejectedValueOnce(apiError);
    await renderLoginPage();

    await fillLoginForm('test@test.com', 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Email o contraseña incorrectos. Verifica tus credenciales.'
        )
      ).toBeInTheDocument();
    });
  });

  it('muestra translatedMessage para otros errores de API', async () => {
    const apiError = {
      status: 500,
      detail: 'Server error',
      translatedMessage: 'Error interno del servidor. Intenta de nuevo más tarde.',
    };
    mockLogin.mockRejectedValueOnce(apiError);
    await renderLoginPage();

    await fillLoginForm('test@test.com', 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => {
      expect(
        screen.getByText('Error interno del servidor. Intenta de nuevo más tarde.')
      ).toBeInTheDocument();
    });
  });

  it('muestra mensaje de éxito cuando el searchParam "registered" está presente', async () => {
    searchParamsMap = { registered: 'true' };
    await renderLoginPage();

    expect(
      screen.getByText('Cuenta creada con éxito. Ahora puedes iniciar sesión.')
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveAttribute('data-variant', 'success');
  });

  it('limpia el error al hacer dismiss del mensaje', async () => {
    const apiError = {
      status: 401,
      detail: 'Invalid',
      translatedMessage: 'No autorizado',
    };
    mockLogin.mockRejectedValueOnce(apiError);
    await renderLoginPage();

    await fillLoginForm('test@test.com', 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const dismissBtn = screen.getByLabelText('Cerrar error');
    await userEvent.click(dismissBtn);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('el botón de submit muestra "Ingresando..." y se deshabilita mientras se envía', async () => {
    // Return a promise that never resolves to keep loading=true
    mockLogin.mockImplementationOnce(() => new Promise(() => {}));
    await renderLoginPage();

    await fillLoginForm('test@test.com', 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    const submitBtn = screen.getByRole('button', { name: 'Ingresando...' });
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).toBeDisabled();
  });

  it('los errores de campo se limpian cuando el usuario comienza a escribir', async () => {
    await renderLoginPage();

    // Submit with invalid data to trigger field errors
    await fillLoginForm('invalido', '1234567');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    // Both field errors should be visible
    expect(screen.getByText('Formato de email inválido')).toBeInTheDocument();
    expect(
      screen.getByText('La contraseña debe tener al menos 8 caracteres')
    ).toBeInTheDocument();

    // Type in the email field — the email error should clear
    const emailInput = screen.getByLabelText('Email');
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, 'valido@test.com');

    // Email error gone, password error still present
    expect(
      screen.queryByText('Formato de email inválido')
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('La contraseña debe tener al menos 8 caracteres')
    ).toBeInTheDocument();
  });
});
