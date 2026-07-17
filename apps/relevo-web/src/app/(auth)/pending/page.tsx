'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, Spinner, ErrorMessage } from '@tiza/ui';
import { Clock, CheckCircle2, Hourglass } from 'lucide-react';
import { fetchTokenFromSession, getStoredUser } from '@/lib/auth';

type PendingState = 'loading' | 'pending' | 'active' | 'error';

export default function PendingPage() {
  const router = useRouter();
  const [state, setState] = useState<PendingState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // Check if user is already active (approved while on this page)
        const token = await fetchTokenFromSession();
        const storedUser = getStoredUser();

        if (token && storedUser && storedUser.status === 'active') {
          setState('active');
          return;
        }

        if (token) {
          setState('pending');
        } else {
          // No token — user landed here directly, redirect to login
          router.push('/login');
        }
      } catch {
        setState('error');
        setErrorMessage('Error al verificar el estado de tu solicitud. Intenta de nuevo.');
      }
    })();
  }, [router]);

  const handleRetry = () => {
    setState('loading');
    setErrorMessage('');
    window.location.reload();
  };

  // ── Active state — user was approved ──
  if (state === 'active') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-gray-900 mt-4">¡Solicitud aprobada!</h2>
          <p className="text-gray-500 mt-2">
            Tu cuenta ya está activa. Puedes acceder al sistema ahora.
          </p>
        </div>
        <Button brand="relevo" className="w-full" onClick={() => router.push('/dashboard')}>
          Ir al dashboard
        </Button>
      </div>
    );
  }

  // ── Error state ──
  if (state === 'error') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-red-100">
            <Clock className="h-6 w-6 text-red-500" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mt-4">Error de verificación</h2>
        </div>

        <ErrorMessage message={errorMessage} variant="error" />

        <div className="flex flex-col gap-3">
          <Button brand="relevo" variant="outline" className="w-full" onClick={handleRetry}>
            Reintentar
          </Button>
          <Link
            href="/login"
            className="text-center text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  // ── Loading state ──
  if (state === 'loading') {
    return (
      <div className="py-12">
        <Spinner size="lg" />
        <p className="text-center text-gray-500 mt-4">Verificando estado de tu solicitud...</p>
      </div>
    );
  }

  // ── Pending state — main content ──
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto h-14 w-14 flex items-center justify-center rounded-full bg-blue-50">
          <Clock className="h-7 w-7 text-brand-primary" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mt-4">Solicitud Enviada</h2>
        <p className="text-gray-500 mt-2 text-sm leading-relaxed">
          Tu solicitud de acceso está siendo revisada por nuestro equipo. Te notificaremos por
          correo electrónico cuando sea aprobada. Esto suele tomar entre 24 y 48 horas hábiles.
        </p>
      </div>

      {/* Stepper */}
      <div className="space-y-4" role="list" aria-label="Progreso de la solicitud">
        {/* Step 1 — Completed */}
        <div className="flex items-start gap-3" role="listitem">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900">Solicitud enviada</p>
            <p className="text-sm text-gray-500">Hemos recibido tu solicitud correctamente</p>
          </div>
        </div>

        {/* Step 2 — Active */}
        <div className="flex items-start gap-3" role="listitem" aria-current="step">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center">
            <Clock className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-brand-primary">En revisión</p>
            <p className="text-sm text-gray-500">Nuestro equipo está evaluando tu solicitud</p>
          </div>
        </div>

        {/* Step 3 — Pending */}
        <div className="flex items-start gap-3" role="listitem">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <Hourglass className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-400">Aprobación</p>
            <p className="text-sm text-gray-400">Recibirás un correo cuando sea aprobada</p>
          </div>
        </div>
      </div>

      {/* Action */}
      <Link href="/login" className="block">
        <Button brand="relevo" variant="outline" className="w-full">
          Volver al inicio
        </Button>
      </Link>
    </div>
  );
}
