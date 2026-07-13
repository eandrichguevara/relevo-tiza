'use client';

import { Card, Spinner } from '@tiza/ui';
import { useDashboardStats } from '@/hooks/useApi';
import { BarChart3, TrendingUp, Target, Award } from 'lucide-react';

export default function ReportesPage() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-secondary mb-6">Reportes y estadísticas</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card title="Rendimiento general">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center">
              <Target className="text-brand-primary" size={32} />
            </div>
            <div>
              <p className="text-3xl font-bold text-brand-secondary">
                {stats?.average_grade?.toFixed(1) || '—'}
              </p>
              <p className="text-sm text-gray-500">Promedio general del curso</p>
            </div>
          </div>
          <div className="h-2 bg-gray-200 rounded-full">
            <div
              className="h-2 bg-brand-primary rounded-full transition-all"
              style={{ width: `${Math.min(((stats?.average_grade || 0) / 7) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">Escala 1.0 — 7.0</p>
        </Card>

        <Card title="Actividad">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BarChart3 className="text-blue-500" size={24} />
                <span className="text-gray-600">Evaluaciones totales</span>
              </div>
              <span className="font-bold text-lg">{stats?.total_evaluations || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Award className="text-green-500" size={24} />
                <span className="text-gray-600">Alumnos evaluados</span>
              </div>
              <span className="font-bold text-lg">{stats?.total_students || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp className="text-purple-500" size={24} />
                <span className="text-gray-600">Corregidas esta semana</span>
              </div>
              <span className="font-bold text-lg">{stats?.completed_this_week || 0}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Tiempo ahorrado">
        <div className="text-center py-8">
          <p className="text-5xl font-bold text-brand-primary mb-2">
            {(stats?.total_evaluations || 0) * 2}
            <span className="text-2xl text-gray-500 font-normal"> horas</span>
          </p>
          <p className="text-gray-500">
            Tiempo estimado ahorrado usando TIZA. ¡Eso es{' '}
            {Math.round(((stats?.total_evaluations || 0) * 2) / 8)} días de clase!
          </p>
        </div>
      </Card>
    </div>
  );
}
