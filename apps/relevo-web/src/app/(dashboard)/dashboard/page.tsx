'use client';

import { Card, Spinner, EmptyState, Badge } from '@tiza/ui';
import { useExecutiveStats } from '@/hooks/useRelevoApi';
import { useFeatures } from '@/hooks/useFeatures';
import { useActiveTenant } from '@/hooks/ActiveTenantContext';
import { School, Users, FileText, TrendingUp, Target, BarChart3 } from 'lucide-react';

export default function RelevoDashboard() {
  const { data: stats, isLoading } = useExecutiveStats();
  const { features, isLoaded } = useFeatures();
  const { activeTenant } = useActiveTenant();

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-brand-primary">Dashboard ejecutivo</h1>
        {activeTenant && (
          <Badge variant="info">
            <School size={14} className="mr-1" />
            {activeTenant.name}
          </Badge>
        )}
      </div>
      <p className="text-gray-500 mb-8">Visión general de todos tus colegios</p>

      {/* KPIs ejecutivos — visibles solo si executiveKPIs feature flag está activo */}
      {isLoaded && features.executiveKPIs ? (
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
                <p className="text-3xl font-bold">
                  {stats?.average_performance?.toFixed(1) || '—'}
                </p>
                <p className="text-sm text-gray-500">Rendimiento promedio</p>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <div className="mb-8">
          <EmptyState
            icon={<BarChart3 size={48} />}
            title="KPIs ejecutivos no disponibles"
            description="La visualización de indicadores clave está desactivada para tu plan actual."
          />
        </div>
      )}

      <Card title="Tendencia de rendimiento">
        <div className="h-64 flex items-center justify-center text-gray-400">
          <TrendingUp size={48} />
          <span className="ml-2">Gráfico de tendencia — próximamente</span>
        </div>
      </Card>
    </div>
  );
}
