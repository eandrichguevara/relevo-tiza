'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input, Button, ErrorMessage } from '@tiza/ui';
import { validatePassword, validateConfirmPassword } from '@/lib/validators';
import { useAuth } from '@/hooks/useAuth';
import type { ApiError } from '@/lib/api';

interface FormErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ── Client-side validation ──
    const errors: FormErrors = {
      currentPassword: !currentPassword ? 'La contraseña actual es obligatoria' : undefined,
      newPassword: validatePassword(newPassword) ?? undefined,
      confirmPassword: validateConfirmPassword(newPassword, confirmPassword) ?? undefined,
    };

    if (currentPassword && newPassword && currentPassword === newPassword) {
      errors.newPassword = 'La nueva contraseña no puede ser igual a la contraseña actual';
    }

    setFieldErrors(errors);
    setGeneralError('');

    if (errors.currentPassword || errors.newPassword || errors.confirmPassword) return;

    // ── Submit ──
    setLoading(true);

    try {
      await changePassword(currentPassword, newPassword);
      // Success -> redirect to dashboard
      window.location.href = '/dashboard';
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      const isApiErr = typeof apiErr?.status === 'number' && apiErr.status > 0;
      console.error('[Change Password Error]', {
        isApiError: isApiErr,
        status: isApiErr ? apiErr.status : undefined,
        detail: isApiErr ? apiErr.detail : undefined,
        message: err instanceof Error ? err.message : undefined,
        raw: err,
      });

      if (isApiErr && apiErr.translatedMessage) {
        setGeneralError(apiErr.translatedMessage);
      } else if (err instanceof Error) {
        setGeneralError(err.message || 'Error al cambiar la contraseña. Intenta de nuevo.');
      } else {
        setGeneralError('Error al cambiar la contraseña. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setGeneralError('');

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-4"
      aria-label="Formulario de cambio de contraseña obligatoria"
    >
      <h2 className="text-xl font-semibold text-center mb-2">Cambiar contraseña</h2>
      <p className="text-sm text-gray-600 text-center mb-6">
        Por motivos de seguridad, debes cambiar tu contraseña provisoria antes de continuar a la plataforma.
      </p>

      {generalError && (
        <ErrorMessage message={generalError} variant="error" onDismiss={clearError} />
      )}

      <Input
        label="Contraseña provisoria / actual"
        type="password"
        value={currentPassword}
        onChange={(e) => {
          setCurrentPassword(e.target.value);
          if (fieldErrors.currentPassword) {
            setFieldErrors((prev) => ({ ...prev, currentPassword: undefined }));
          }
        }}
        placeholder="Tu contraseña provisoria"
        error={fieldErrors.currentPassword}
        autoComplete="current-password"
        required
      />

      <Input
        label="Nueva contraseña"
        type="password"
        value={newPassword}
        onChange={(e) => {
          setNewPassword(e.target.value);
          if (fieldErrors.newPassword) {
            setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
          }
        }}
        placeholder="Nueva contraseña (mínimo 8 caracteres)"
        error={fieldErrors.newPassword}
        autoComplete="new-password"
        required
      />

      <Input
        label="Confirmar nueva contraseña"
        type="password"
        value={confirmPassword}
        onChange={(e) => {
          setConfirmPassword(e.target.value);
          if (fieldErrors.confirmPassword) {
            setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
          }
        }}
        placeholder="Repite tu nueva contraseña"
        error={fieldErrors.confirmPassword}
        autoComplete="new-password"
        required
      />

      <Button type="submit" loading={loading} disabled={loading} brand="tiza" className="w-full">
        {loading ? 'Guardando...' : 'Cambiar contraseña y continuar'}
      </Button>
    </form>
  );
}
