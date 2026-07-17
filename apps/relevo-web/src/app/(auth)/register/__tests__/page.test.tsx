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

const mockApiFetch = vi.fn();
vi.mock('@/lib/api', () => ({
  apiFetch: (...args: any[]) => mockApiFetch(...args),
}));

vi.mock('@tiza/ui', () => ({
  Input: ({ label, error, hint, ...rest }: any) => (
    <div>
      <label>
        {label}
        <input {...rest} aria-label={label} data-error={error || ''} />
      </label>
      {error && <span role="alert">{error}</span>}
      {hint && !error && <span className="hint">{hint}</span>}
    </div>
  ),
  Button: ({ children, loading, disabled, ...rest }: any) => (
    <button disabled={disabled || loading} {...rest}>
      {loading ? 'Enviando solicitud...' : children}
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

async function fillValidForm() {
  const page = await getModule();
  const { default: RegisterPage } = page;
  render(<RegisterPage />);

  await userEvent.type(screen.getByLabelText('Nombre completo'), 'Director Test');
  await userEvent.type(screen.getByLabelText('Nombre del colegio'), 'Colegio San Miguel');
  await userEvent.type(screen.getByLabelText('Email corporativo'), 'director@colegio.cl');
  await userEvent.type(screen.getByLabelText('Contraseña'), 'password123');
  await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'password123');

  return page;
}

// ─── Tests ──────────────────────────────────────────────────

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el formulario con todos los campos', async () => {
    const { default: RegisterPage } = await getModule();
    render(<RegisterPage />);

    expect(screen.getByText('Solicitar demo')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre completo')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre del colegio')).toBeInTheDocument();
    expect(screen.getByLabelText('Email corporativo')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmar contraseña')).toBeInTheDocument();
    expect(screen.getByText('Solicitar acceso')).toBeInTheDocument();
    expect(screen.getByText('Inicia sesión')).toBeInTheDocument();
  });

  it('tiene aria-label "Formulario de solicitud de demo"', async () => {
    const { default: RegisterPage } = await getModule();
    render(<RegisterPage />);
    expect(screen.getByLabelText('Formulario de solicitud de demo')).toBeInTheDocument();
  });

  it('redirige a /pending en registro exitoso', async () => {
    mockApiFetch.mockResolvedValueOnce(undefined);
    await fillValidForm();

    await userEvent.click(screen.getByText('Solicitar acceso'));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Director Test',
          email: 'director@colegio.cl',
          password: 'password123',
          school: 'Colegio San Miguel',
          role: 'director',
        }),
      });
    });
    expect(mockPush).toHaveBeenCalledWith('/pending');
  });

  it('muestra error de validación para nombre vacío', async () => {
    const { default: RegisterPage } = await getModule();
    render(<RegisterPage />);

    await userEvent.type(screen.getByLabelText('Email corporativo'), 'test@test.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'password123');
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'password123');
    await userEvent.click(screen.getByText('Solicitar acceso'));

    expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('muestra error de validación para email inválido', async () => {
    const { default: RegisterPage } = await getModule();
    render(<RegisterPage />);

    await userEvent.type(screen.getByLabelText('Nombre completo'), 'Director Test');
    await userEvent.type(screen.getByLabelText('Nombre del colegio'), 'Colegio');
    await userEvent.type(screen.getByLabelText('Email corporativo'), 'invalido');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'password123');
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'password123');
    await userEvent.click(screen.getByText('Solicitar acceso'));

    expect(screen.getByText('Formato de email inválido')).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('muestra error de validación para contraseña corta', async () => {
    const { default: RegisterPage } = await getModule();
    render(<RegisterPage />);

    await userEvent.type(screen.getByLabelText('Nombre completo'), 'Director Test');
    await userEvent.type(screen.getByLabelText('Nombre del colegio'), 'Colegio');
    await userEvent.type(screen.getByLabelText('Email corporativo'), 'test@test.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), '123');
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), '123');
    await userEvent.click(screen.getByText('Solicitar acceso'));

    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres')).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('muestra error de validación cuando contraseñas no coinciden', async () => {
    const { default: RegisterPage } = await getModule();
    render(<RegisterPage />);

    await userEvent.type(screen.getByLabelText('Nombre completo'), 'Director Test');
    await userEvent.type(screen.getByLabelText('Nombre del colegio'), 'Colegio');
    await userEvent.type(screen.getByLabelText('Email corporativo'), 'test@test.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'password123');
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'otra12345');
    await userEvent.click(screen.getByText('Solicitar acceso'));

    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('muestra error 409 (email ya registrado)', async () => {
    const apiError = {
      status: 409,
      detail: 'Email exists',
      translatedMessage: 'El registro ya existe',
    };
    mockApiFetch.mockRejectedValueOnce(apiError);
    await fillValidForm();

    await userEvent.click(screen.getByText('Solicitar acceso'));
    await waitFor(() => {
      expect(
        screen.getByText('Este email ya está registrado. Si ya tienes cuenta, inicia sesión.')
      ).toBeInTheDocument();
    });
  });

  it('muestra error 422 (datos inválidos)', async () => {
    const apiError = { status: 422, detail: 'Validation error' };
    mockApiFetch.mockRejectedValueOnce(apiError);
    await fillValidForm();

    await userEvent.click(screen.getByText('Solicitar acceso'));
    await waitFor(() => {
      expect(
        screen.getByText('Datos inválidos. Verifica que todos los campos estén correctos.')
      ).toBeInTheDocument();
    });
  });

  it('muestra translatedMessage en error genérico', async () => {
    const apiError = { status: 500, translatedMessage: 'Error del servidor.' };
    mockApiFetch.mockRejectedValueOnce(apiError);
    await fillValidForm();

    await userEvent.click(screen.getByText('Solicitar acceso'));
    await waitFor(() => {
      expect(screen.getByText('Error del servidor.')).toBeInTheDocument();
    });
  });
});
