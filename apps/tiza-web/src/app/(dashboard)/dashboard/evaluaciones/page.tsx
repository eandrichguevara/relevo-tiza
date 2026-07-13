'use client';

import Link from 'next/link';
import { Card, Button, Badge, Spinner, EmptyState } from '@tiza/ui';
import { Plus, FileText, Trash2, ChevronRight } from 'lucide-react';
import { useEvaluations, useDeleteEvaluation } from '@/hooks/useApi';
import { useState } from 'react';

export default function EvaluacionesPage() {
  const { data: evaluations, isLoading } = useEvaluations();
  const deleteEval = useDeleteEvaluation();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta evaluación?')) return;
    setDeleting(id);
    try {
      await deleteEval.mutateAsync(id);
    } catch (err) {
      alert('Error al eliminar');
    } finally {
      setDeleting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brand-secondary">Evaluaciones</h1>
        <Link href="/dashboard/evaluaciones/nueva">
          <Button brand="tiza">
            <Plus size={16} className="mr-1" /> Nueva evaluación
          </Button>
        </Link>
      </div>

      {!evaluations || evaluations.length === 0 ? (
        <EmptyState
          title="No hay evaluaciones aún"
          description="Crea tu primera evaluación y comienza a ahorrar tiempo"
          action={
            <Link href="/dashboard/evaluaciones/nueva">
              <Button brand="tiza" size="lg">Crear evaluación</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {evaluations.map((evaluation: any) => (
            <Card key={evaluation.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <FileText size={20} className="text-brand-primary" />
                    <h3 className="font-semibold text-gray-900">{evaluation.title}</h3>
                    <StatusBadge status={evaluation.status} />
                  </div>
                  <p className="text-sm text-gray-500">
                    {evaluation.subject} — {evaluation.grade}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(evaluation.created_at).toLocaleDateString('es-CL')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDelete(evaluation.id)}
                    disabled={deleting === evaluation.id}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    aria-label={`Eliminar evaluación ${evaluation.title}`}
                  >
                    <Trash2 size={16} />
                  </button>
                  <Link
                    href={`/dashboard/evaluaciones/${evaluation.id}`}
                    aria-label={`Ver detalle de ${evaluation.title}`}
                  >
                    <ChevronRight size={20} className="text-gray-400" />
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
    pending: 'neutral',
    processing: 'info',
    completed: 'success',
    requires_review: 'warning',
    reviewed: 'success',
  };

  const labels: Record<string, string> = {
    pending: 'Pendiente',
    processing: 'Procesando',
    completed: 'Completada',
    requires_review: 'Por revisar',
    reviewed: 'Revisada',
  };

  return <Badge variant={variants[status] || 'neutral'}>{labels[status] || status}</Badge>;
}
