'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Spinner, EmptyState, ErrorMessage } from '@tiza/ui';
import { CheckCircle, XCircle, Clock, Users, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePendingRegistrations, useApproveUser, useRejectUser } from '@/hooks/useRelevoApi';
import ConfirmModal from '@/components/ConfirmModal';
import type { PendingRegistration } from '@tiza/types';

// ─── Main page ────────────────────────────────────────────

export default function AdminPendientesPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { data, isLoading, isError, error, refetch } = usePendingRegistrations();
  const approveMutation = useApproveUser();
  const rejectMutation = useRejectUser();

  // Modal state
  const [approveTarget, setApproveTarget] = useState<PendingRegistration | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingRegistration | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Auth guard ──
  if (authLoading) {
    return (
      <div className="py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const isAuthorized = user?.role === 'ADMIN' || user?.role === 'HOLDER';
  if (!isAuthenticated || !isAuthorized) {
    return (
      <Card brand="relevo" className="max-w-lg mx-auto mt-10">
        <div className="text-center py-8">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-400" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-gray-900 mt-4">Acceso restringido</h2>
          <p className="text-gray-500 mt-2 text-sm">
            Solo administradores y directores pueden acceder a esta sección.
          </p>
          <Button
            brand="relevo"
            variant="outline"
            className="mt-6"
            onClick={() => router.push('/dashboard')}
          >
            Volver al dashboard
          </Button>
        </div>
      </Card>
    );
  }

  // ── Toast helper ──
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Approve handler ──
  const handleApprove = async () => {
    if (!approveTarget) return;
    try {
      await approveMutation.mutateAsync(approveTarget.id);
      showToast(`Solicitud de ${approveTarget.name} aprobada correctamente`, 'success');
      setApproveTarget(null);
    } catch {
      showToast('Error al aprobar la solicitud. Intenta de nuevo.', 'error');
    }
  };

  // ── Reject handler ──
  const handleReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      setRejectError('Debes ingresar un motivo de rechazo.');
      return;
    }
    try {
      await rejectMutation.mutateAsync({ userId: rejectTarget.id, reason: rejectReason.trim() });
      showToast(`Solicitud de ${rejectTarget.name} rechazada`, 'success');
      setRejectTarget(null);
      setRejectReason('');
      setRejectError('');
    } catch {
      showToast('Error al rechazar la solicitud. Intenta de nuevo.', 'error');
    }
  };

  // ── Format date helper ──
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('es-CL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // ── Role label helper ──
  const roleLabel = (role: string) => {
    const labels: Record<string, string> = {
      HOLDER: 'Sostenedor',
      TEACHER: 'Profesor',
      ADMIN: 'Administrador',
      director: 'Director',
    };
    return labels[role] || role;
  };

  const pendingCount = data?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
          role="alert"
        >
          {toast.message}
        </div>
      )}

      {/* Approve confirmation modal */}
      {approveTarget && (
        <ConfirmModal
          title="Aprobar solicitud"
          onConfirm={handleApprove}
          onCancel={() => setApproveTarget(null)}
          confirmLabel="Aprobar"
          confirmVariant="primary"
          loading={approveMutation.isPending}
        >
          <p>
            ¿Estás seguro de aprobar a <strong>{approveTarget.name}</strong> ({approveTarget.email}
            )?
          </p>
          <p className="mt-2 text-gray-500">El usuario recibirá acceso completo al sistema.</p>
        </ConfirmModal>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <ConfirmModal
          title="Rechazar solicitud"
          onConfirm={handleReject}
          onCancel={() => {
            setRejectTarget(null);
            setRejectReason('');
            setRejectError('');
          }}
          confirmLabel="Rechazar solicitud"
          confirmVariant="danger"
          loading={rejectMutation.isPending}
        >
          <p>
            ¿Estás seguro de rechazar a <strong>{rejectTarget.name}</strong> ({rejectTarget.email})?
          </p>
          <div className="mt-4">
            <label htmlFor="reject-reason" className="block text-sm font-medium text-gray-700 mb-1">
              Motivo del rechazo <span className="text-red-500">*</span>
            </label>
            <textarea
              id="reject-reason"
              rows={3}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${
                rejectError
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-brand-primary'
              } focus:outline-none focus:ring-2`}
              placeholder="Indica el motivo del rechazo..."
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                if (rejectError) setRejectError('');
              }}
              aria-invalid={!!rejectError}
              aria-describedby={rejectError ? 'reject-error' : undefined}
            />
            {rejectError && (
              <p id="reject-error" className="mt-1 text-sm text-red-600">
                {rejectError}
              </p>
            )}
          </div>
        </ConfirmModal>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Solicitudes Pendientes</h1>
          {pendingCount > 0 && (
            <Badge variant="warning">
              <Clock className="inline-block h-3.5 w-3.5 mr-1" aria-hidden="true" />
              {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-20">
          <Spinner size="lg" />
          <p className="text-center text-gray-500 mt-4">Cargando solicitudes...</p>
        </div>
      ) : isError ? (
        <Card brand="relevo">
          <ErrorMessage
            message={(error as Error)?.message || 'Error al cargar las solicitudes pendientes.'}
            variant="error"
          />
          <div className="mt-4 flex justify-center">
            <Button variant="outline" brand="relevo" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        </Card>
      ) : !data || data.items.length === 0 ? (
        <Card brand="relevo">
          <EmptyState
            title="No hay solicitudes pendientes"
            description="Todas las solicitudes de registro han sido procesadas."
            icon={<Users className="h-12 w-12 text-gray-300" aria-hidden="true" />}
          />
        </Card>
      ) : (
        <Card brand="relevo" padding="none">
          {/* Table for desktop */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Solicitudes de registro pendientes">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Rol</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Fecha de solicitud
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((reg) => (
                  <tr key={reg.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{reg.name}</td>
                    <td className="px-4 py-3 text-gray-600">{reg.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant="info">{roleLabel(reg.role)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDate(reg.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          brand="relevo"
                          onClick={() => setApproveTarget(reg)}
                          aria-label={`Aprobar a ${reg.name}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" aria-hidden="true" />
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setRejectTarget(reg)}
                          aria-label={`Rechazar a ${reg.name}`}
                        >
                          <XCircle className="h-4 w-4 mr-1" aria-hidden="true" />
                          Rechazar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
