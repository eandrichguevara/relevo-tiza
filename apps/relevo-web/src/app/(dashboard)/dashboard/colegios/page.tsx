'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Input, Spinner, EmptyState, ErrorMessage } from '@tiza/ui';
import { School, Plus, Building2, ExternalLink, X, Copy, Check } from 'lucide-react';
import { useTenants, useCreateTenant } from '@/hooks/useRelevoApi';
import { formatTenantDomain, getDomainHint } from '@/lib/domain';

export default function ColegiosPage() {
  const router = useRouter();
  const { data: tenants, isLoading, error, refetch } = useTenants();
  const createTenant = useCreateTenant();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', subdomain: '' });
  const [formError, setFormError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyCode = async (tenantId: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(tenantId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard not available — silently fail
    }
  };

  const handleOpenModal = () => {
    setForm({ name: '', subdomain: '' });
    setFormError('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const name = form.name.trim();
    const subdomain = form.subdomain.trim();

    if (!name || !subdomain) {
      setFormError('Todos los campos son obligatorios.');
      return;
    }

    // Validate subdomain format (alphanumeric + hyphens only)
    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      setFormError('El subdominio solo puede contener letras minúsculas, números y guiones.');
      return;
    }

    try {
      await createTenant.mutateAsync({ name, subdomain });
      handleCloseModal();
    } catch (err: any) {
      setFormError(err?.translatedMessage || 'Error al crear el colegio. Intenta de nuevo.');
    }
  };

  const apiError = error as { translatedMessage?: string } | null;

  return (
    <div>
      {/* ─── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Colegios</h1>
          <p className="text-gray-500">Gestiona tus establecimientos educacionales</p>
        </div>
        <Button brand="relevo" onClick={handleOpenModal}>
          <Plus size={16} className="mr-1" />
          Nuevo colegio
        </Button>
      </div>

      {/* ─── Loading State ──────────────────────────── */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* ─── Error State ────────────────────────────── */}
      {!isLoading && error && (
        <div className="space-y-4">
          <ErrorMessage message={apiError?.translatedMessage || 'Error al cargar los colegios.'} />
          <Button variant="outline" brand="relevo" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {/* ─── Empty State ────────────────────────────── */}
      {!isLoading && !error && tenants && tenants.length === 0 && (
        <EmptyState
          title="No tienes colegios aún"
          description="Crea tu primer colegio para empezar a gestionar tus establecimientos educacionales."
          icon={<Building2 size={48} />}
          action={
            <Button brand="relevo" onClick={handleOpenModal}>
              <Plus size={16} className="mr-1" />
              Crear colegio
            </Button>
          }
        />
      )}

      {/* ─── Schools List ───────────────────────────── */}
      {!isLoading && !error && tenants && tenants.length > 0 && (
        <div className="space-y-3" role="list" aria-label="Lista de colegios">
          {tenants.map((tenant) => (
            <Card key={tenant.id} brand="relevo">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand-light flex items-center justify-center">
                    <School className="text-brand-primary" size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{tenant.name}</h3>
                    <p className="text-sm text-gray-500 truncate">{formatTenantDomain(tenant)}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-xs text-gray-400">Código:</span>
                      <span className="font-mono text-sm font-medium tracking-wider bg-gray-100 rounded-md px-2 py-0.5 text-gray-600 select-all">
                        {tenant.join_code}
                      </span>
                      <button
                        onClick={() => handleCopyCode(tenant.id, tenant.join_code)}
                        className="p-0.5 rounded text-gray-400 hover:text-brand-primary transition-colors"
                        aria-label={`Copiar código de registro de ${tenant.name}`}
                      >
                        {copiedId === tenant.id ? (
                          <Check size={14} className="text-green-500" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  brand="relevo"
                  size="sm"
                  className="flex-shrink-0"
                  onClick={() => router.push(`/dashboard/usuarios?tenant_id=${tenant.id}`)}
                  aria-label={`Gestionar usuarios de ${tenant.name}`}
                >
                  Gestionar
                  <ExternalLink size={14} className="ml-1" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ─── Create School Modal ────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={handleCloseModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-2">
              <h2 id="modal-title" className="text-xl font-bold text-brand-primary">
                Nuevo colegio
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

            {/* Modal body */}
            <form onSubmit={handleCreate}>
              <div className="px-6 py-4 space-y-4">
                <Input
                  label="Nombre del colegio"
                  placeholder="Ej: Colegio San Martín"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <Input
                  label="Subdominio"
                  placeholder="Ej: san-martin"
                  hint={`Se usará como san-martin${getDomainHint()} — solo minúsculas, números y guiones`}
                  value={form.subdomain}
                  onChange={(e) => setForm({ ...form, subdomain: e.target.value.toLowerCase() })}
                  required
                />
              </div>

              {formError && (
                <div className="px-6">
                  <ErrorMessage message={formError} />
                </div>
              )}

              {/* Modal footer */}
              <div className="flex justify-end gap-3 px-6 pb-6 pt-2">
                <Button type="button" variant="ghost" onClick={handleCloseModal}>
                  Cancelar
                </Button>
                <Button type="submit" brand="relevo" loading={createTenant.isPending}>
                  Crear colegio
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
