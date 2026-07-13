'use client';

import { Card, Spinner } from '@tiza/ui';
import { useExecutiveStats } from '@/hooks/useRelevoApi';
import { School, Users, FileText, TrendingUp, Target } from 'lucide-react';

export default function RelevoDashboard() {
  const { data: stats, isLoading } = useExecutiveStats();

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-primary mb-2">Dashboard ejecutivo</h1>
      <p className="text-gray-500 mb-8">Visión general de todos tus colegios</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <div className="flex items-center gap-3">
            <School className="text-brand-primary" size={28} />
            <div>
              <p className="text-3xl font-bold">{stats?.total_schools || 0}</p>
              <p className="text-sm text-gray-500">Colegios activos</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Users className="text-brand-primary" size={28} />
            <div>
              <p className="text-3xl font-bold">{stats?.total_teachers || 0}</p>
              <p className="text-sm text-gray-500">Profesores</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <FileText className="text-brand-primary" size={28} />
            <div>
              <p className="text-3xl font-bold">{stats?.total_evaluations || 0}</p>
              <p className="text-sm text-gray-500">Evaluaciones</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Target className="text-brand-primary" size={28} />
            <div>
              <p className="text-3xl font-bold">{stats?.average_performance?.toFixed(1) || '—'}</p>
              <p className="text-sm text-gray-500">Rendimiento promedio</p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Tendencia de rendimiento">
        <div className="h-64 flex items-center justify-center text-gray-400">
          <TrendingUp size={48} />
          <span className="ml-2">Gráfico de tendencia — próximamente</span>
        </div>
      </Card>
    </div>
  );
}
