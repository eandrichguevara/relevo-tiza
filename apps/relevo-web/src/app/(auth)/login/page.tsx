'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Input, Button, ErrorMessage } from '@tiza/ui';
import { useAuth } from '@/hooks/useAuth';
import type { ApiError } from '@/lib/api';

interface FormErrors {
  email?: string;
  password?: string;
}

function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'El email es obligatorio';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Formato de email inválido';
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) return 'La contraseña es obligatoria';
  if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres';
  return undefined;
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
      setSuccessMessage('Solicitud enviada correctamente. Te contactaremos pronto.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ── Client-side validation ──
    const errors: FormErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
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
      console.error('[Login Error]', err);
      const apiErr = err as ApiError;
      if (apiErr?.status === 401) {
        setGeneralError('Credenciales incorrectas. Verifica tu email y contraseña.');
      } else {
        setGeneralError(apiErr?.translatedMessage || 'Error de conexión. Intenta de nuevo.');
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
      aria-label="Formulario de acceso"
    >
      <h2 className="text-xl font-semibold text-center mb-6">Acceso RELEVO</h2>

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
