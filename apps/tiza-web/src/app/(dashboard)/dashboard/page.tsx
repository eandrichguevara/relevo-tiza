'use client';

import Link from 'next/link';
import { Card, Spinner, Badge, EmptyState } from '@tiza/ui';
import { FileText, Clock, CheckCircle, AlertTriangle, Plus, BarChart3 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardStats } from '@/hooks/useApi';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-secondary">
            ¡Hola, {user?.name || 'Profesor'}!
          </h1>
          <p className="text-gray-500 mt-1">Resumen de tu actividad</p>
        </div>
        <Link
          href="/dashboard/evaluaciones/nueva"
          className="bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-accent transition-colors font-medium flex items-center gap-2"
        >
          <Plus size={18} />
          Nueva evaluación
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Card>
          <div className="flex items-center gap-3">
            <FileText className="text-brand-primary" size={24} />
            <div>
              <p className="text-2xl font-bold">{stats?.total_evaluations || 0}</p>
              <p className="text-sm text-gray-500">Evaluaciones</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <CheckCircle className="text-green-500" size={24} />
            <div>
              <p className="text-2xl font-bold">{stats?.completed_this_week || 0}</p>
              <p className="text-sm text-gray-500">Esta semana</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-500" size={24} />
            <div>
              <p className="text-2xl font-bold">{stats?.pending_review || 0}</p>
              <p className="text-sm text-gray-500">Por revisar</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <BarChart3 className="text-blue-500" size={24} />
            <div>
              <p className="text-2xl font-bold">{stats?.total_students || 0}</p>
              <p className="text-sm text-gray-500">Alumnos</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Clock className="text-purple-500" size={24} />
            <div>
              <p className="text-2xl font-bold">{stats?.average_grade?.toFixed(1) || '—'}</p>
              <p className="text-sm text-gray-500">Promedio</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick actions */}
      <Card title="Acciones rápidas">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/dashboard/evaluaciones/nueva"
            className="p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-brand-primary hover:bg-brand-light/50 transition-colors text-center"
          >
            <Plus className="mx-auto mb-2 text-gray-400" size={24} />
            <p className="font-medium text-gray-700">Nueva evaluación</p>
            <p className="text-sm text-gray-500">Crea y configura una prueba</p>
          </Link>
          <Link
            href="/dashboard/revisar"
            className="p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-brand-primary hover:bg-brand-light/50 transition-colors text-center"
          >
            <AlertTriangle className="mx-auto mb-2 text-gray-400" size={24} />
            <p className="font-medium text-gray-700">Revisar pendientes</p>
            <p className="text-sm text-gray-500">{stats?.pending_review || 0} pruebas esperando</p>
          </Link>
          <Link
            href="/dashboard/evaluaciones"
            className="p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-brand-primary hover:bg-brand-light/50 transition-colors text-center"
          >
            <FileText className="mx-auto mb-2 text-gray-400" size={24} />
            <p className="font-medium text-gray-700">Ver evaluaciones</p>
            <p className="text-sm text-gray-500">Historial completo</p>
          </Link>
        </div>
      </Card>
    </div>
  );
}
