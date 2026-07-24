import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ──────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockChangePassword = vi.fn();
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: (...args: any[]) => mockUseAuth(...args),
}));

vi.mock('@tiza/ui', () => ({
  Input: ({ label, error, onChange, ...rest }: any) => (
    <div>
      <label>
        {label}
        <input onChange={onChange} {...rest} aria-label={label} data-error={error || ''} />
      </label>
      {error && <span role="alert">{error}</span>}
    </div>
  ),
  Button: ({ children, loading, disabled, onClick, ...rest }: any) => (
    <button disabled={disabled || loading} onClick={onClick} {...rest}>
      {loading ? 'Guardando...' : children}
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
  return await import('../(auth)/change-password/page');
}

// ─── Helpers ────────────────────────────────────────────────

async function renderChangePasswordPage() {
  const { default: ChangePasswordPage } = await getModule();
  return render(<ChangePasswordPage />);
}

async function fillForm(fields: {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}) {
  if (fields.currentPassword !== undefined) {
    await userEvent.type(
      screen.getByLabelText('Contraseña provisoria / actual'),
      fields.currentPassword
    );
  }
  if (fields.newPassword !== undefined) {
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), fields.newPassword);
  }
  if (fields.confirmPassword !== undefined) {
    await userEvent.type(
      screen.getByLabelText('Confirmar nueva contraseña'),
      fields.confirmPassword
    );
  }
}

// ─── Tests ──────────────────────────────────────────────────

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      changePassword: mockChangePassword,
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('renderiza el formulario con todos los campos y texto descriptivo', async () => {
    await renderChangePasswordPage();

    expect(screen.getByText('Cambiar contraseña')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Por motivos de seguridad, debes cambiar tu contraseña provisoria antes de continuar a la plataforma.'
      )
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña provisoria / actual')).toBeInTheDocument();
    expect(screen.getByLabelText('Nueva contraseña')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmar nueva contraseña')).toBeInTheDocument();
    expect(screen.getByText('Cambiar contraseña y continuar')).toBeInTheDocument();
  });

  it('el formulario tiene el aria-label correcto', async () => {
    await renderChangePasswordPage();

    expect(
      screen.getByLabelText('Formulario de cambio de contraseña obligatoria')
    ).toBeInTheDocument();
  });

  it('valida que la contraseña actual sea obligatoria', async () => {
    await renderChangePasswordPage();

    await fillForm({ newPassword: 'newPass123', confirmPassword: 'newPass123' });
    await userEvent.click(screen.getByText('Cambiar contraseña y continuar'));

    expect(screen.getByText('La contraseña actual es obligatoria')).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('valida que la nueva contraseña tenga al menos 8 caracteres', async () => {
    await renderChangePasswordPage();

    await fillForm({
      currentPassword: 'oldPass1',
      newPassword: '1234567',
      confirmPassword: '1234567',
    });
    await userEvent.click(screen.getByText('Cambiar contraseña y continuar'));

    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres')).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('valida que la confirmación de contraseña coincida', async () => {
    await renderChangePasswordPage();

    await fillForm({
      currentPassword: 'oldPass1',
      newPassword: 'newPass123',
      confirmPassword: 'differentPass',
    });
    await userEvent.click(screen.getByText('Cambiar contraseña y continuar'));

    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('muestra error cuando la nueva contraseña es igual a la actual', async () => {
    await renderChangePasswordPage();

    await fillForm({
      currentPassword: 'samePassword',
      newPassword: 'samePassword',
      confirmPassword: 'samePassword',
    });
    await userEvent.click(screen.getByText('Cambiar contraseña y continuar'));

    expect(
      screen.getByText('La nueva contraseña no puede ser igual a la contraseña actual')
    ).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('envío exitoso llama a changePassword y redirige', async () => {
    const originalLocation = window.location;
    const mockHref = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '' },
      writable: true,
    });

    mockChangePassword.mockResolvedValueOnce(undefined);

    await renderChangePasswordPage();

    await fillForm({
      currentPassword: 'oldPass123',
      newPassword: 'newPass456',
      confirmPassword: 'newPass456',
    });
    await userEvent.click(screen.getByText('Cambiar contraseña y continuar'));

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith('oldPass123', 'newPass456');
    });

    expect(window.location.href).toBe('/dashboard');

    // Restore
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  it('muestra translatedMessage cuando el error es un ApiError con translatedMessage', async () => {
    mockChangePassword.mockRejectedValueOnce({
      status: 400,
      detail: 'Bad request',
      translatedMessage: 'La contraseña actual no es correcta.',
    });

    await renderChangePasswordPage();

    await fillForm({
      currentPassword: 'wrongOld',
      newPassword: 'newPass456',
      confirmPassword: 'newPass456',
    });
    await userEvent.click(screen.getByText('Cambiar contraseña y continuar'));

    await waitFor(() => {
      expect(screen.getByText('La contraseña actual no es correcta.')).toBeInTheDocument();
    });
  });

  it('muestra mensaje genérico para errores que no son ApiError', async () => {
    mockChangePassword.mockRejectedValueOnce(new Error('Something went wrong'));

    await renderChangePasswordPage();

    await fillForm({
      currentPassword: 'oldPass123',
      newPassword: 'newPass456',
      confirmPassword: 'newPass456',
    });
    await userEvent.click(screen.getByText('Cambiar contraseña y continuar'));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  it('muestra mensaje genérico por defecto cuando el error no es una instancia de Error ni ApiError', async () => {
    mockChangePassword.mockRejectedValueOnce(undefined);

    await renderChangePasswordPage();

    await fillForm({
      currentPassword: 'oldPass123',
      newPassword: 'newPass456',
      confirmPassword: 'newPass456',
    });
    await userEvent.click(screen.getByText('Cambiar contraseña y continuar'));

    await waitFor(() => {
      expect(
        screen.getByText('Error al cambiar la contraseña. Intenta de nuevo.')
      ).toBeInTheDocument();
    });
  });

  it('el error se puede cerrar con el botón de dismiss', async () => {
    mockChangePassword.mockRejectedValueOnce({
      status: 400,
      detail: 'Bad request',
      translatedMessage: 'La contraseña actual no es correcta.',
    });

    await renderChangePasswordPage();

    await fillForm({
      currentPassword: 'wrongOld',
      newPassword: 'newPass456',
      confirmPassword: 'newPass456',
    });
    await userEvent.click(screen.getByText('Cambiar contraseña y continuar'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const dismissBtn = screen.getByLabelText('Cerrar error');
    await userEvent.click(dismissBtn);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
