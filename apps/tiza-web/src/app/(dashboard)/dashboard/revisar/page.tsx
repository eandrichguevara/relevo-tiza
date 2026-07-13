'use client';

import Link from 'next/link';
import { Card, Badge, Spinner, EmptyState } from '@tiza/ui';
import { AlertTriangle, ChevronRight, CheckCircle } from 'lucide-react';
import { usePendingReviews } from '@/hooks/useApi';

export default function RevisarPage() {
  const { data: pending, isLoading } = usePendingReviews();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-secondary mb-6">Revisión pendiente</h1>

      {!pending || pending.length === 0 ? (
        <EmptyState
          title="¡Todo al día!"
          description="No hay evaluaciones pendientes de revisión"
          icon={<CheckCircle size={48} className="text-green-500" />}
        />
      ) : (
        <div className="space-y-3">
          {pending.map((result: any) => (
            <Link key={result.id} href={`/dashboard/revisar/${result.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={20} className="text-yellow-500" />
                    <div>
                      <p className="font-medium">{result.student_code}</p>
                      <p className="text-sm text-gray-500">
                        Confianza IA: {Math.round(result.confidence * 100)}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="warning">Requiere revisión</Badge>
                    <ChevronRight size={20} className="text-gray-400" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
