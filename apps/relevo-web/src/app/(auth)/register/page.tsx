'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input, Button, ErrorMessage } from '@tiza/ui';
import { apiFetch } from '@/lib/api';
import type { ApiError } from '@/lib/api';

interface FormErrors {
  name?: string;
  school?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

function validateName(name: string): string | undefined {
  if (!name.trim()) return 'El nombre es obligatorio';
  if (name.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres';
  return undefined;
}

function validateSchool(school: string): string | undefined {
  if (!school.trim()) return 'El nombre del colegio es obligatorio';
  return undefined;
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

function validateConfirmPassword(password: string, confirmPassword: string): string | undefined {
  if (!confirmPassword) return 'Debes confirmar tu contraseña';
  if (password !== confirmPassword) return 'Las contraseñas no coinciden';
  return undefined;
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
      name: validateName(name),
      school: validateSchool(school),
      email: validateEmail(email),
      password: validatePassword(password),
      confirmPassword: validateConfirmPassword(password, confirmPassword),
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

      router.push('/login?registered=true');
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
        placeholder="Juan Pérez"
        error={fieldErrors.name}
        autoComplete="name"
        required
      />

      <Input
        label="Nombre del colegio"
        value={school}
        onChange={(e) => {
          setSchool(e.target.value);
          if (fieldErrors.school) setFieldErrors((prev) => ({ ...prev, school: undefined }));
        }}
        placeholder="Colegio San Martín"
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
        placeholder="Mínimo 6 caracteres"
        error={fieldErrors.password}
        hint="Mínimo 6 caracteres"
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
