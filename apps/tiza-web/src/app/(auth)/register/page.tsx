'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input, Button, ErrorMessage } from '@tiza/ui';
import { apiFetch } from '@/lib/api';
import type { ApiError } from '@/lib/api';
import {
  validateName,
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validateTenantCode,
} from '@/lib/validators';

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  schoolCode?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [codeStatus, setCodeStatus] = useState<'idle' | 'verifying' | 'valid' | 'invalid'>('idle');
  const [verifiedSchoolName, setVerifiedSchoolName] = useState('');
  const [resolvedTenantId, setResolvedTenantId] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ── Client-side validation ──
    const errors: FormErrors = {
      name: validateName(name) ?? undefined,
      email: validateEmail(email) ?? undefined,
      password: validatePassword(password) ?? undefined,
      confirmPassword: validateConfirmPassword(password, confirmPassword) ?? undefined,
      schoolCode: validateTenantCode(schoolCode) ?? undefined,
    };
    setFieldErrors(errors);
    setGeneralError('');
    setCodeStatus('idle');

    if (
      errors.name ||
      errors.email ||
      errors.password ||
      errors.confirmPassword ||
      errors.schoolCode
    ) {
      return;
    }

    // ── Step 1: Verify school code ──
    setLoading(true);
    setCodeStatus('verifying');
    setGeneralError('');

    try {
      const lookupResult = await apiFetch<{ tenant_id: string; name: string }>(
        `/api/tenants/lookup?code=${encodeURIComponent(schoolCode.trim())}`
      );

      setCodeStatus('valid');
      setVerifiedSchoolName(lookupResult.name);
      setResolvedTenantId(lookupResult.tenant_id);

      // ── Step 2: Register ──
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role: 'teacher',
          tenant_id: lookupResult.tenant_id,
        }),
      });

      router.push('/login?registered=true');
    } catch (err: unknown) {
      console.error('[Register Error]', err);
      const apiErr = err as ApiError;
      if (apiErr?.status === 404) {
        setCodeStatus('invalid');
        setGeneralError('Código no encontrado. Pídele el código a tu director.');
      } else if (apiErr?.status === 409) {
        setCodeStatus('idle');
        setGeneralError('Este email ya está registrado. ¿Ya tienes una cuenta?');
      } else if (apiErr?.status === 422) {
        setCodeStatus('idle');
        setGeneralError('Datos inválidos. Verifica que todos los campos estén correctos.');
      } else {
        setCodeStatus('idle');
        setGeneralError(apiErr?.translatedMessage || 'Error al crear la cuenta. Intenta de nuevo.');
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
      aria-label="Formulario de registro"
    >
      <h2 className="text-xl font-semibold text-center mb-6">Crear cuenta gratis</h2>

      {generalError && (
        <ErrorMessage message={generalError} variant="error" onDismiss={clearError} />
      )}

      <Input
        label="Nombre completo"
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
        }}
        placeholder="Tu nombre completo"
        error={fieldErrors.name}
        autoComplete="name"
        required
      />

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
        placeholder="Mínimo 8 caracteres"
        error={fieldErrors.password}
        hint="Mínimo 8 caracteres"
        autoComplete="new-password"
        required
      />

      <Input
        label="Confirmar contraseña"
        type="password"
        value={confirmPassword}
        onChange={(e) => {
          setConfirmPassword(e.target.value);
          if (fieldErrors.confirmPassword) {
            setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
          }
        }}
        placeholder="Repite tu contraseña"
        error={fieldErrors.confirmPassword}
        autoComplete="new-password"
        required
      />

      {/* ── School code field ── */}
      <div className="w-full">
        <Input
          label="Código de tu colegio"
          type="text"
          value={schoolCode}
          onChange={(e) => {
            setSchoolCode(e.target.value);
            setCodeStatus('idle');
            setVerifiedSchoolName('');
            setResolvedTenantId('');
            if (fieldErrors.schoolCode) {
              setFieldErrors((prev) => ({ ...prev, schoolCode: undefined }));
            }
          }}
          placeholder="Ej: ABC123"
          error={
            fieldErrors.schoolCode ||
            (codeStatus === 'invalid'
              ? 'Código no válido. Verifica e intenta de nuevo.'
              : undefined)
          }
          autoComplete="off"
          required
        />
        {/* Code status indicators */}
        {codeStatus === 'verifying' && (
          <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-500" aria-live="polite">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Verificando código...</span>
          </div>
        )}
        {codeStatus === 'valid' && (
          <p className="mt-1 text-sm text-green-600 flex items-center gap-1" aria-live="polite">
            <svg
              className="h-4 w-4 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Código verificado: <strong>{verifiedSchoolName}</strong>
          </p>
        )}
      </div>

      <Button type="submit" loading={loading} disabled={loading} brand="tiza" className="w-full">
        {loading
          ? codeStatus === 'verifying'
            ? 'Verificando código...'
            : 'Creando cuenta...'
          : 'Crear cuenta'}
      </Button>

      <p className="text-center text-sm text-gray-600">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-[#F4813D] hover:underline font-medium">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
