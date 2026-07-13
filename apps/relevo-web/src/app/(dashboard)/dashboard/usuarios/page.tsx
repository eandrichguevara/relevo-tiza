'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, Button, Input, Badge, Spinner, EmptyState, ErrorMessage } from '@tiza/ui';
import { Plus, Users, UserPlus, Copy, Check, X, RefreshCw } from 'lucide-react';
import { useTenants, useUsers, useCreateUser } from '@/hooks/useRelevoApi';
import type { User } from '@tiza/types';

// ─── Password generator ──────────────────────────────────

function generatePassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;

  // Ensure at least one of each category
  const required = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];

  // Fill the rest randomly
  const remaining = Array.from({ length: 10 }, () => all[Math.floor(Math.random() * all.length)]);

  // Shuffle and join
  return [...required, ...remaining].sort(() => Math.random() - 0.5).join('');
}

// ─── Date formatting ─────────────────────────────────────

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

// ─── Role badge config ───────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; variant: 'info' | 'neutral' | 'success' }> = {
  HOLDER: { label: 'Sostenedor', variant: 'info' },
  TEACHER: { label: 'Profesor', variant: 'neutral' },
  ADMIN: { label: 'Admin', variant: 'success' },
};

function getRoleConfig(role: string) {
  return ROLE_CONFIG[role] || { label: role, variant: 'neutral' as const };
}

// ─── Main content (extracted for Suspense) ───────────────

function UsuariosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedTenantId = searchParams.get('tenant_id');

  const { data: tenants, isLoading: tenantsLoading } = useTenants();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(preselectedTenantId);

  // Sync URL param with selection
  useMemo(() => {
    if (preselectedTenantId && !selectedTenantId) {
      setSelectedTenantId(preselectedTenantId);
    }
  }, [preselectedTenantId, selectedTenantId]);

  const {
    data: users,
    isLoading: usersLoading,
    error: usersError,
    refetch: refetchUsers,
  } = useUsers(selectedTenantId);

  const createUser = useCreateUser();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ email: '', name: '' });
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [passwordCopied, setPasswordCopied] = useState(false);

  const selectedTenant = useMemo(
    () => tenants?.find((t) => t.id === selectedTenantId),
    [tenants, selectedTenantId]
  );

  // ─── Modal handlers ────────────────────────────────

  const handleOpenModal = () => {
    const pw = generatePassword();
    setForm({ email: '', name: '' });
    setGeneratedPassword(pw);
    setFormError('');
    setFormSuccess('');
    setPasswordCopied(false);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormError('');
    setFormSuccess('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const email = form.email.trim();
    const name = form.name.trim();

    if (!email || !name) {
      setFormError('Todos los campos son obligatorios.');
      return;
    }

    if (!email.includes('@')) {
      setFormError('Ingresa un correo electrónico válido.');
      return;
    }

    if (!selectedTenantId) {
      setFormError('Selecciona un colegio primero.');
      return;
    }

    try {
      await createUser.mutateAsync({
        email,
        name,
        password: generatedPassword,
        tenantId: selectedTenantId,
      });
      setFormSuccess(`Profesor creado exitosamente. Contraseña: ${generatedPassword}`);
      setForm({ email: '', name: '' });
      setGeneratedPassword(generatePassword());
      setPasswordCopied(false);
    } catch (err: any) {
      setFormError(err?.translatedMessage || 'Error al crear el profesor. Intenta de nuevo.');
    }
  };

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 2000);
    } catch {
      // Fallback: select the text manually
      setPasswordCopied(false);
    }
  };

  // ─── Handle tenant selection ───────────────────────

  const handleTenantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedTenantId(value || null);
    // Update URL without navigation
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('tenant_id', value);
    } else {
      params.delete('tenant_id');
    }
    router.replace(`/dashboard/usuarios?${params.toString()}`, { scroll: false });
  };

  const usersErrorObj = usersError as { translatedMessage?: string } | null;
  const isCreatePending = createUser.isPending;

  return (
    <div>
      {/* ─── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Usuarios</h1>
          <p className="text-gray-500">Gestión de profesores y administradores</p>
        </div>
        <Button
          brand="relevo"
          onClick={handleOpenModal}
          disabled={!selectedTenantId}
          aria-label="Nuevo profesor"
        >
          <UserPlus size={16} className="mr-1" />
          Nuevo profesor
        </Button>
      </div>

      {/* ─── School Selector ────────────────────────── */}
      <Card brand="relevo" padding="sm" className="mb-6">
        <div className="flex items-center gap-3">
          <label
            htmlFor="tenant-select"
            className="text-sm font-medium text-gray-700 whitespace-nowrap"
          >
            Colegio:
          </label>
          {tenantsLoading ? (
            <Spinner size="sm" />
          ) : (
            <select
              id="tenant-select"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-[#1A3A5C] focus:ring-offset-1
                bg-white"
              value={selectedTenantId || ''}
              onChange={handleTenantChange}
              aria-label="Seleccionar colegio"
            >
              <option value="">— Selecciona un colegio —</option>
              {tenants?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {selectedTenant && <Badge variant="info">{selectedTenant.subdomain}.relevo.cl</Badge>}
        </div>
      </Card>

      {/* ─── No tenant selected ─────────────────────── */}
      {!selectedTenantId && !tenantsLoading && (
        <EmptyState
          title="Selecciona un colegio"
          description="Elige un colegio del selector para ver sus usuarios."
          icon={<Users size={48} />}
        />
      )}

      {/* ─── Loading users ──────────────────────────── */}
      {selectedTenantId && usersLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* ─── Users error ────────────────────────────── */}
      {selectedTenantId && !usersLoading && usersError && (
        <div className="space-y-4">
          <ErrorMessage
            message={usersErrorObj?.translatedMessage || 'Error al cargar los usuarios.'}
          />
          <Button variant="outline" brand="relevo" onClick={() => refetchUsers()}>
            <RefreshCw size={14} className="mr-1" />
            Reintentar
          </Button>
        </div>
      )}

      {/* ─── Empty users ────────────────────────────── */}
      {selectedTenantId && !usersLoading && !usersError && users && users.length === 0 && (
        <EmptyState
          title="No hay usuarios en este colegio"
          description="Agrega el primer profesor para empezar a trabajar."
          icon={<Users size={48} />}
          action={
            <Button brand="relevo" onClick={handleOpenModal}>
              <UserPlus size={16} className="mr-1" />
              Agregar profesor
            </Button>
          }
        />
      )}

      {/* ─── Users table ────────────────────────────── */}
      {selectedTenantId && !usersLoading && !usersError && users && users.length > 0 && (
        <Card brand="relevo" padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table" aria-label="Usuarios del colegio">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="py-3 px-4 font-medium text-gray-500">Nombre</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Email</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Rol</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Creado</th>
                  <th className="py-3 px-4 font-medium text-gray-500 sr-only">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: User & { createdAt?: string }) => (
                  <tr
                    key={u.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-gray-900">{u.name}</td>
                    <td className="py-3 px-4 text-gray-500">{u.email}</td>
                    <td className="py-3 px-4">
                      <Badge variant={getRoleConfig(u.role).variant}>
                        {getRoleConfig(u.role).label}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-gray-500">{formatDate(u.createdAt)}</td>
                    <td className="py-3 px-4" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ─── Create User Modal ──────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={handleCloseModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-modal-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-2">
              <h2 id="user-modal-title" className="text-xl font-bold text-brand-primary">
                Nuevo profesor
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Cerrar modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleCreate}>
              <div className="px-6 py-4 space-y-4">
                {/* Selected school info */}
                {selectedTenant && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    <Users size={14} />
                    <span>
                      Agregando a: <strong>{selectedTenant.name}</strong>
                    </span>
                  </div>
                )}

                <Input
                  label="Nombre del profesor"
                  placeholder="Ej: María González"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <Input
                  label="Correo electrónico"
                  type="email"
                  placeholder="ej: maria@colegio.cl"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />

                {/* Auto-generated password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contraseña (generada automáticamente)
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono bg-gray-50 text-gray-800 select-all">
                      {generatedPassword}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="flex-shrink-0 p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors"
                      aria-label="Copiar contraseña"
                      title="Copiar contraseña"
                    >
                      {passwordCopied ? (
                        <Check size={16} className="text-green-600" />
                      ) : (
                        <Copy size={16} className="text-gray-500" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setGeneratedPassword(generatePassword())}
                      className="flex-shrink-0 p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors"
                      aria-label="Generar nueva contraseña"
                      title="Generar nueva contraseña"
                    >
                      <RefreshCw size={16} className="text-gray-500" />
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Copia esta contraseña para compartirla con el profesor.
                  </p>
                </div>
              </div>

              {/* Success message */}
              {formSuccess && (
                <div className="px-6 mb-2">
                  <div
                    className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm"
                    role="alert"
                  >
                    <Check size={16} className="flex-shrink-0" />
                    <span>{formSuccess}</span>
                  </div>
                </div>
              )}

              {/* Error message */}
              {formError && (
                <div className="px-6 mb-2">
                  <ErrorMessage message={formError} />
                </div>
              )}

              {/* Footer */}
              <div className="flex justify-end gap-3 px-6 pb-6 pt-2">
                <Button type="button" variant="ghost" onClick={handleCloseModal}>
                  Cancelar
                </Button>
                <Button type="submit" brand="relevo" loading={isCreatePending}>
                  Crear profesor
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page wrapper with Suspense (for useSearchParams) ────

export default function UsuariosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      }
    >
      <UsuariosContent />
    </Suspense>
  );
}
