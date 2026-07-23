'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Input, Button, ErrorMessage } from '@tiza/ui';
import { validateEmail, validatePassword } from '@/lib/validators';
import { useAuth } from '@/hooks/useAuth';
import type { ApiError } from '@/lib/api';

interface FormErrors {
  email?: string;
  password?: string;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  // Check for success message from registration redirect
  useEffect(() => {
    if (searchParams?.get('registered')) {
      setSuccessMessage('Cuenta creada con éxito. Ahora puedes iniciar sesión.');
    }
  }, [searchParams]);

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

      // Login successful — redirect to dashboard
      window.location.href = '/dashboard';
    } catch (err: unknown) {
      // Structured error logging — always shows status/detail even for empty errors
      const apiErr = err as ApiError;
      const isApiErr = typeof apiErr?.status === 'number' && apiErr.status > 0;
      const errStatus = apiErr?.status ?? (err instanceof Error ? 'native_error' : 'unknown');
      const errDetail = apiErr?.detail ?? (err instanceof Error ? err.message : undefined);
      console.error('[Login Error]', {
        status: errStatus,
        detail: errDetail || '(no detail)',
        isApiError: isApiErr,
        raw: err,
      });
      if (isApiErr && apiErr.status === 401) {
        setGeneralError('Email o contraseña incorrectos. Verifica tus credenciales.');
      } else if (isApiErr && apiErr.status === 403) {
        const detailLower = (apiErr.detail || '').toLowerCase();
        if (detailLower.includes('pendiente') || detailLower.includes('pending')) {
          setGeneralError(
            'Tu cuenta está pendiente de aprobación. Te notificaremos por correo cuando sea aprobada.'
          );
        } else if (detailLower.includes('rechaz') || detailLower.includes('rejected')) {
          setGeneralError('Tu solicitud fue rechazada. Contacta al administrador.');
        } else {
          setGeneralError('Acceso denegado. No tienes permisos para acceder.');
        }
      } else if (isApiErr && apiErr.translatedMessage) {
        setGeneralError(apiErr.translatedMessage);
      } else if (errStatus === 0) {
        setGeneralError('Error de conexión. Verifica tu internet e intenta de nuevo.');
      } else if (err instanceof Error) {
        setGeneralError(err.message || 'Error de conexión. Intenta de nuevo.');
      } else {
        setGeneralError('Error de conexión. Intenta de nuevo.');
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
      aria-label="Formulario de inicio de sesión"
    >
      <h2 className="text-xl font-semibold text-center mb-6">Iniciar sesión</h2>

      {successMessage && <ErrorMessage message={successMessage} variant="success" />}

      {generalError && (
        <ErrorMessage message={generalError} variant="error" onDismiss={clearError} />
      )}

      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
        }}
        placeholder="tu@correo.com"
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
        placeholder="Tu contraseña"
        error={fieldErrors.password}
        autoComplete="current-password"
        required
      />

      <Button type="submit" loading={loading} disabled={loading} brand="tiza" className="w-full">
        {loading ? 'Ingresando...' : 'Ingresar'}
      </Button>

      <p className="text-center text-sm text-gray-600">
        ¿No tienes cuenta?{' '}
        <Link href="/register" className="text-[#F4813D] hover:underline font-medium">
          Regístrate gratis
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
