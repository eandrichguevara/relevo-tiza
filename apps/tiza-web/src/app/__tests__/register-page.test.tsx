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
  apiFetch: mockApiFetch,
  ApiError: {},
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
      {children}
    </button>
  ),
  ErrorMessage: ({ message, variant, onDismiss }: any) => (
    <div role="alert" data-variant={variant}>
      {message}
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Cerrar error">
          ×
        </button>
      )}
    </div>
  ),
}));

// ─── Helpers ────────────────────────────────────────────────

function deferred() {
  let resolve!: (value: any) => void;
  let reject!: (reason: any) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function getModule() {
  return await import('../(auth)/register/page');
}

async function renderRegisterPage() {
  const { default: RegisterPage } = await getModule();
  return render(<RegisterPage />);
}

const validFormData = {
  name: 'Juan Pérez',
  email: 'juan@colegio.cl',
  password: 'password123',
  confirmPassword: 'password123',
  schoolCode: 'ABC123',
} as const;

async function fillValidForm() {
  await userEvent.type(screen.getByLabelText('Nombre completo'), validFormData.name);
  await userEvent.type(screen.getByLabelText('Email'), validFormData.email);
  await userEvent.type(screen.getByLabelText('Contraseña'), validFormData.password);
  await userEvent.type(
    screen.getByLabelText('Confirmar contraseña'),
    validFormData.confirmPassword
  );
  await userEvent.type(screen.getByLabelText('Código de tu colegio'), validFormData.schoolCode);
}

// ─── Tests ──────────────────────────────────────────────────

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Render Tests ────────────────────────────────────────

  it('renderiza el formulario de registro con todos los campos', async () => {
    await renderRegisterPage();

    expect(screen.getByText('Crear cuenta gratis')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre completo')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmar contraseña')).toBeInTheDocument();
    expect(screen.getByLabelText('Código de tu colegio')).toBeInTheDocument();
    expect(screen.getByText('Crear cuenta')).toBeInTheDocument();
    expect(screen.getByText('¿Ya tienes cuenta?')).toBeInTheDocument();

    const loginLink = screen.getByText('Inicia sesión');
    expect(loginLink).toBeInTheDocument();
    expect(loginLink.closest('a')).toHaveAttribute('href', '/login');
  });

  it('tiene el aria-label correcto en el formulario', async () => {
    await renderRegisterPage();

    expect(screen.getByLabelText('Formulario de registro')).toBeInTheDocument();
  });

  // ── Client-side Validation ──────────────────────────────

  it('muestra errores de validación al enviar el formulario vacío', async () => {
    await renderRegisterPage();

    await userEvent.click(screen.getByText('Crear cuenta'));

    await waitFor(() => {
      expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
    });
    expect(screen.getByText('El email es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('La contraseña es obligatoria')).toBeInTheDocument();
    expect(screen.getByText('Debes confirmar tu contraseña')).toBeInTheDocument();
    expect(screen.getByText('El código del colegio es obligatorio')).toBeInTheDocument();

    // No API calls should have been made
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('no envía el formulario si hay errores de validación', async () => {
    await renderRegisterPage();

    // Fill with invalid data (leave schoolCode empty — it is already empty from render)
    await userEvent.type(screen.getByLabelText('Nombre completo'), 'A');
    await userEvent.type(screen.getByLabelText('Email'), 'invalido');
    await userEvent.type(screen.getByLabelText('Contraseña'), '123');
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), '456');
    await userEvent.click(screen.getByText('Crear cuenta'));

    await waitFor(() => {
      expect(screen.getByText('El nombre debe tener al menos 2 caracteres')).toBeInTheDocument();
    });
    expect(screen.getByText('Formato de email inválido')).toBeInTheDocument();
    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres')).toBeInTheDocument();
    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();
    expect(screen.getByText('El código del colegio es obligatorio')).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  // ── Successful Flow ─────────────────────────────────────

  it('flujo exitoso: verifica código, registra y redirige a /login?registered=true', async () => {
    mockApiFetch
      .mockResolvedValueOnce({ tenant_id: 'tenant-123', name: 'Colegio San Miguel' })
      .mockResolvedValueOnce(undefined);

    await renderRegisterPage();
    await fillValidForm();
    await userEvent.click(screen.getByText('Crear cuenta'));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(2);
    });

    const calls = mockApiFetch.mock.calls;

    // First call: verify school code
    expect(calls[0][0]).toBe('/api/tenants/lookup?code=ABC123');

    // Second call: register
    expect(calls[1][0]).toBe('/api/auth/register');
    expect(calls[1][1]).toMatchObject({
      method: 'POST',
      body: expect.any(String),
    });

    const bodyArg = JSON.parse(calls[1][1].body);
    expect(bodyArg).toEqual({
      name: 'Juan Pérez',
      email: 'juan@colegio.cl',
      password: 'password123',
      role: 'teacher',
      tenant_id: 'tenant-123',
    });

    expect(mockPush).toHaveBeenCalledWith('/login?registered=true');
  });

  // ── Verifying State ─────────────────────────────────────

  it('muestra el estado "Verificando código..." mientras se verifica el código escolar', async () => {
    const lookupDeferred = deferred();
    mockApiFetch.mockReturnValueOnce(lookupDeferred.promise);

    await renderRegisterPage();
    await fillValidForm();
    await userEvent.click(screen.getByText('Crear cuenta'));

    await waitFor(() => {
      // Appears both in the spinner indicator and the submit button
      const elements = screen.getAllByText('Verificando código...');
      expect(elements.length).toBeGreaterThanOrEqual(2);
    });

    // Ensure no push happened yet
    expect(mockPush).not.toHaveBeenCalled();
  });

  // ── Verified State ──────────────────────────────────────

  it('muestra el nombre del colegio después de verificar el código', async () => {
    mockApiFetch
      .mockResolvedValueOnce({ tenant_id: 'tenant-123', name: 'Colegio San Miguel' })
      // Second call delays so we can observe the verified state before it resolves
      .mockReturnValueOnce(new Promise(() => {}));

    await renderRegisterPage();
    await fillValidForm();
    await userEvent.click(screen.getByText('Crear cuenta'));

    await waitFor(() => {
      expect(screen.getByText(/Código verificado/)).toBeInTheDocument();
    });
    expect(screen.getByText('Colegio San Miguel')).toBeInTheDocument();
  });

  // ── Error Handling: 404 (invalid school code) ──────────

  it('maneja error 404 — código de colegio no encontrado', async () => {
    mockApiFetch.mockRejectedValueOnce({
      status: 404,
      detail: 'Recurso no encontrado.',
      translatedMessage: 'Recurso no encontrado.',
    });

    await renderRegisterPage();
    await fillValidForm();
    await userEvent.click(screen.getByText('Crear cuenta'));

    await waitFor(() => {
      expect(
        screen.getByText('Código no encontrado. Pídele el código a tu director.')
      ).toBeInTheDocument();
    });

    // The school code input should also show the inline error
    expect(screen.getByText('Código no válido. Verifica e intenta de nuevo.')).toBeInTheDocument();

    expect(mockPush).not.toHaveBeenCalled();
  });

  // ── Error Handling: 409 (duplicate email) ──────────────

  it('maneja error 409 — email ya registrado', async () => {
    mockApiFetch
      .mockResolvedValueOnce({ tenant_id: 'tenant-123', name: 'Colegio San Miguel' })
      .mockRejectedValueOnce({
        status: 409,
        detail: 'El registro ya existe. Intenta con otro email.',
        translatedMessage: 'El registro ya existe. Intenta con otro email.',
      });

    await renderRegisterPage();
    await fillValidForm();
    await userEvent.click(screen.getByText('Crear cuenta'));

    await waitFor(() => {
      expect(
        screen.getByText('Este email ya está registrado. ¿Ya tienes una cuenta?')
      ).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  // ── Error Handling: 422 (validation error) ─────────────

  it('maneja error 422 — datos inválidos', async () => {
    mockApiFetch
      .mockResolvedValueOnce({ tenant_id: 'tenant-123', name: 'Colegio San Miguel' })
      .mockRejectedValueOnce({
        status: 422,
        detail: 'Datos inválidos.',
        translatedMessage: 'Datos inválidos.',
      });

    await renderRegisterPage();
    await fillValidForm();
    await userEvent.click(screen.getByText('Crear cuenta'));

    await waitFor(() => {
      expect(
        screen.getByText('Datos inválidos. Verifica que todos los campos estén correctos.')
      ).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  // ── Error Handling: translatedMessage for other errors ─

  it('muestra translatedMessage para errores de estado no controlado (ej: 500)', async () => {
    mockApiFetch
      .mockResolvedValueOnce({ tenant_id: 'tenant-123', name: 'Colegio San Miguel' })
      .mockRejectedValueOnce({
        status: 500,
        detail: 'Server error',
        translatedMessage: 'Error interno del servidor.',
      });

    await renderRegisterPage();
    await fillValidForm();
    await userEvent.click(screen.getByText('Crear cuenta'));

    await waitFor(() => {
      expect(screen.getByText('Error interno del servidor.')).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('usa mensaje genérico de fallback cuando no hay translatedMessage', async () => {
    mockApiFetch
      .mockResolvedValueOnce({ tenant_id: 'tenant-123', name: 'Colegio San Miguel' })
      .mockRejectedValueOnce({
        status: 500,
        detail: 'Server error',
        // No translatedMessage provided
      });

    await renderRegisterPage();
    await fillValidForm();
    await userEvent.click(screen.getByText('Crear cuenta'));

    await waitFor(() => {
      expect(screen.getByText('Error al crear la cuenta. Intenta de nuevo.')).toBeInTheDocument();
    });
  });

  // ── Error Dismiss ───────────────────────────────────────

  it('limpia el error general al hacer clic en el botón de cerrar', async () => {
    mockApiFetch.mockRejectedValueOnce({
      status: 404,
      detail: 'Not found',
      translatedMessage: 'Not found',
    });

    await renderRegisterPage();
    await fillValidForm();
    await userEvent.click(screen.getByText('Crear cuenta'));

    await waitFor(() => {
      // Multiple alerts: ErrorMessage + inline school code error
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBe(2);
    });

    const dismissBtn = screen.getByLabelText('Cerrar error');
    await userEvent.click(dismissBtn);

    // Only the inline school code error remains (the dismissable one is gone)
    await waitFor(() => {
      expect(
        screen.getByText('Código no válido. Verifica e intenta de nuevo.')
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText('Código no encontrado. Pídele el código a tu director.')
    ).not.toBeInTheDocument();
  });

  // ── Field Errors Clear on Change ───────────────────────

  it('los errores de campo se limpian cuando el usuario comienza a escribir en ese campo', async () => {
    await renderRegisterPage();

    // Submit empty form to trigger all field errors
    await userEvent.click(screen.getByText('Crear cuenta'));

    await waitFor(() => {
      expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
    });
    expect(screen.getByText('El email es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('La contraseña es obligatoria')).toBeInTheDocument();
    expect(screen.getByText('Debes confirmar tu contraseña')).toBeInTheDocument();
    expect(screen.getByText('El código del colegio es obligatorio')).toBeInTheDocument();

    // Type in the name field → name error clears, others remain
    const nameInput = screen.getByLabelText('Nombre completo');
    await userEvent.type(nameInput, 'Juan');

    await waitFor(() => {
      expect(screen.queryByText('El nombre es obligatorio')).not.toBeInTheDocument();
    });
    // Other errors should still be visible
    expect(screen.getByText('El email es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('La contraseña es obligatoria')).toBeInTheDocument();
    expect(screen.getByText('Debes confirmar tu contraseña')).toBeInTheDocument();
    expect(screen.getByText('El código del colegio es obligatorio')).toBeInTheDocument();
  });

  it('limpia el error del código escolar al cambiar el valor del input', async () => {
    mockApiFetch.mockRejectedValueOnce({
      status: 404,
      detail: 'Not found',
      translatedMessage: 'Not found',
    });

    await renderRegisterPage();
    await fillValidForm();
    await userEvent.click(screen.getByText('Crear cuenta'));

    // Wait for the 404 error to appear
    await waitFor(() => {
      expect(
        screen.getByText('Código no encontrado. Pídele el código a tu director.')
      ).toBeInTheDocument();
    });
    expect(screen.getByText('Código no válido. Verifica e intenta de nuevo.')).toBeInTheDocument();

    // Clear and type in the school code field
    const schoolCodeInput = screen.getByLabelText('Código de tu colegio');
    await userEvent.clear(schoolCodeInput);
    await userEvent.type(schoolCodeInput, 'XYZ789');

    // The inline error should clear
    await waitFor(() => {
      expect(
        screen.queryByText('Código no válido. Verifica e intenta de nuevo.')
      ).not.toBeInTheDocument();
    });
  });
});
