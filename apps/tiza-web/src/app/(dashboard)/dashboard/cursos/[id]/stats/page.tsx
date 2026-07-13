'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, Badge, Spinner, EmptyState } from '@tiza/ui';
import { ArrowLeft, Users, BarChart3, Target, Award, TrendingUp } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function CourseStatsPage() {
  const params = useParams();
  const courseId = params.id as string;
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    (async () => {
      try {
        const session = await fetch('/api/auth/session').then((r) => r.json());
        const token = (session as any)?.accessToken;
        const res = await fetch(`${API_URL}/api/dashboard/course/${courseId}`, {
          headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Brand': 'tiza' },
        });
        const data = await res.json();
        setStats(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  });

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  if (!stats) return <EmptyState title="Error al cargar estadísticas" />;

  const avgGrade = stats.average_grade || 0;
  const barWidth = Math.min((avgGrade / 7) * 100, 100);

  return (
    <div>
      <Link
        href="/dashboard/cursos"
        className="text-brand-primary text-sm hover:underline mb-2 inline-block"
      >
        <ArrowLeft size={14} className="inline mr-1" />
        Volver a cursos
      </Link>

      <h1 className="text-2xl font-bold text-brand-secondary mb-2">{stats.course_name}</h1>
      <p className="text-gray-500 mb-6">Estadísticas y rendimiento</p>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <div className="flex items-center gap-3">
            <Users className="text-brand-primary" size={24} />
            <div>
              <p className="text-2xl font-bold">{stats.total_students}</p>
              <p className="text-xs text-gray-500">Alumnos</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <BarChart3 className="text-green-500" size={24} />
            <div>
              <p className="text-2xl font-bold">{stats.total_evaluations}</p>
              <p className="text-xs text-gray-500">Evaluaciones</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Target className="text-brand-primary" size={24} />
            <div>
              <p className="text-2xl font-bold">{avgGrade.toFixed(1)}</p>
              <p className="text-xs text-gray-500">Promedio</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Award className="text-yellow-500" size={24} />
            <div>
              <p className="text-2xl font-bold">
                {stats.students?.filter((s: any) => (s.latest_grade || 0) >= 5.5).length || 0}
              </p>
              <p className="text-xs text-gray-500">Sobresalientes</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Average bar */}
      <Card className="mb-6">
        <h3 className="font-semibold mb-3">Rendimiento general del curso</h3>
        <div className="flex items-center gap-4">
          <span className="text-3xl font-bold text-brand-primary">{avgGrade.toFixed(1)}</span>
          <div className="flex-1">
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-primary rounded-full transition-all"
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Escala 1.0 — 7.0</p>
          </div>
        </div>
      </Card>

      {/* Student list */}
      <Card title="Rendimiento por alumno">
        {!stats.students || stats.students.length === 0 ? (
          <EmptyState title="Sin datos" description="Simula una evaluación para ver resultados" />
        ) : (
          <div className="space-y-2">
            {stats.students.map((s: any, i: number) => {
              const grade = s.latest_grade;
              const hasGrade = grade !== null && grade !== undefined;
              const isGood = hasGrade && grade >= 5.5;
              const isOk = hasGrade && grade >= 4.0 && grade < 5.5;
              const isLow = hasGrade && grade < 4.0;
              return (
                <div
                  key={s.student_id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm w-6">{i + 1}</span>
                    <span className="font-medium">{s.full_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {hasGrade ? (
                      <>
                        <span className="font-bold">{grade.toFixed(1)}</span>
                        <Badge variant={isGood ? 'success' : isOk ? 'info' : 'error'}>
                          {isGood ? 'Sobresaliente' : isOk ? 'Adecuado' : 'Reforzar'}
                        </Badge>
                      </>
                    ) : (
                      <Badge variant="neutral">Sin evaluar</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
