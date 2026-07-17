'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input, Button, ErrorMessage } from '@tiza/ui';
import { useAuth } from '@/hooks/useAuth';
import type { ApiError } from '@/lib/api';
import { validateEmail, validatePassword } from '@/lib/validators';

interface FormErrors {
  email?: string;
  password?: string;
}

function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [isPendingAccount, setIsPendingAccount] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ── Client-side validation ──
    const errors: FormErrors = {
      email: validateEmail(email) ?? undefined,
      password: validatePassword(password) ?? undefined,
    };
    setFieldErrors(errors);
    setGeneralError('');

    if (errors.email || errors.password) return;

    // ── Submit ──
    setLoading(true);

    try {
      await login(email.trim(), password);
      router.push('/dashboard');
    } catch (err: unknown) {
      // Structured error logging — avoids `{}` in monitoring tools
      const apiErr = err as ApiError;
      const isApiErr = typeof apiErr?.status === 'number' && apiErr.status > 0;
      console.error('[Login Error]', {
        isApiError: isApiErr,
        status: isApiErr ? apiErr.status : undefined,
        detail: isApiErr ? apiErr.detail : undefined,
        message: err instanceof Error ? err.message : undefined,
        raw: err,
      });
      if (isApiErr && apiErr.status === 401) {
        setGeneralError('Credenciales incorrectas. Verifica tu email y contraseña.');
      } else if (isApiErr && apiErr.status === 403) {
        const detailLower = (apiErr.detail || '').toLowerCase();
        if (detailLower.includes('pendiente') || detailLower.includes('pending')) {
          setGeneralError(
            'Tu cuenta está pendiente de aprobación. Te notificaremos por correo cuando sea aprobada.'
          );
          setIsPendingAccount(true);
        } else if (detailLower.includes('rechaz') || detailLower.includes('rejected')) {
          setGeneralError('Tu solicitud fue rechazada. Contacta al administrador.');
        } else {
          setGeneralError('Acceso denegado. No tienes permisos para acceder.');
        }
      } else if (isApiErr && apiErr.translatedMessage) {
        setGeneralError(apiErr.translatedMessage);
      } else if (err instanceof Error) {
        setGeneralError(err.message || 'Error de conexión. Intenta de nuevo.');
      } else {
        setGeneralError('Error de conexión. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setGeneralError('');
    setIsPendingAccount(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-4"
      aria-label="Formulario de acceso"
    >
      <h2 className="text-xl font-semibold text-center mb-6">Acceso RELEVO</h2>

      {generalError && (
        <ErrorMessage message={generalError} variant="error" onDismiss={clearError} />
      )}
      {isPendingAccount && (
        <p className="text-center">
          <Link href="/pending" className="text-sm text-[#1A3A5C] hover:underline font-medium">
            Ver estado de mi solicitud &rarr;
          </Link>
        </p>
      )}

      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
        }}
        placeholder="director@colegio.cl"
        error={fieldErrors.email}
        autoComplete="email"
        required
      />

      <Input
        label="Contraseña"
        type="password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
        }}
        placeholder="••••••••"
        error={fieldErrors.password}
        autoComplete="current-password"
        required
      />

      <Button type="submit" loading={loading} disabled={loading} brand="relevo" className="w-full">
        {loading ? 'Ingresando...' : 'Ingresar'}
      </Button>

      <p className="text-center text-sm text-gray-600">
        ¿Primera vez?{' '}
        <Link href="/register" className="text-[#1A3A5C] hover:underline font-medium">
          Solicitar demo
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center py-8 text-gray-500">Cargando...</div>}>
      <LoginForm />
    </Suspense>
  );
}
