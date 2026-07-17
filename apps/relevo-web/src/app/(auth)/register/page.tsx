'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input, Button, ErrorMessage } from '@tiza/ui';
import { apiFetch } from '@/lib/api';
import type { ApiError } from '@/lib/api';
import {
  validateName,
  validateSchool,
  validateEmail,
  validatePassword,
  validateConfirmPassword,
} from '@/lib/validators';

interface FormErrors {
  name?: string;
  school?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ── Client-side validation ──
    const errors: FormErrors = {
      name: validateName(name) ?? undefined,
      school: validateSchool(school) ?? undefined,
      email: validateEmail(email) ?? undefined,
      password: validatePassword(password) ?? undefined,
      confirmPassword: validateConfirmPassword(password, confirmPassword) ?? undefined,
    };
    setFieldErrors(errors);
    setGeneralError('');

    if (errors.name || errors.school || errors.email || errors.password || errors.confirmPassword) {
      return;
    }

    // ── Submit ──
    setLoading(true);

    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          school: school.trim(),
          role: 'director',
        }),
      });

      router.push('/pending');
    } catch (err: unknown) {
      console.error('[Register Error]', err);
      const apiErr = err as ApiError;
      if (apiErr?.status === 409) {
        setGeneralError('Este email ya está registrado. Si ya tienes cuenta, inicia sesión.');
      } else if (apiErr?.status === 422) {
        setGeneralError('Datos inválidos. Verifica que todos los campos estén correctos.');
      } else {
        setGeneralError(
          apiErr?.translatedMessage || 'Error al enviar la solicitud. Intenta de nuevo.'
        );
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
      aria-label="Formulario de solicitud de demo"
    >
      <h2 className="text-xl font-semibold text-center mb-6">Solicitar demo</h2>

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
        label="Nombre del colegio"
        type="text"
        value={school}
        onChange={(e) => {
          setSchool(e.target.value);
          if (fieldErrors.school) setFieldErrors((prev) => ({ ...prev, school: undefined }));
        }}
        placeholder="Nombre de tu colegio"
        error={fieldErrors.school}
        required
      />

      <Input
        label="Email corporativo"
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
        placeholder="Confirma tu contraseña"
        error={fieldErrors.confirmPassword}
        autoComplete="new-password"
        required
      />

      <Button type="submit" loading={loading} disabled={loading} brand="relevo" className="w-full">
        {loading ? 'Enviando solicitud...' : 'Solicitar acceso'}
      </Button>

      <p className="text-center text-sm text-gray-600">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-[#1A3A5C] hover:underline font-medium">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
