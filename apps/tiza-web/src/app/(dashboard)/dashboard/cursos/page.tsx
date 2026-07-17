'use client';

import Link from 'next/link';
import { Card, Button, Badge, Spinner, EmptyState } from '@tiza/ui';
import {
  Users,
  BookOpen,
  Trash2,
  BarChart3,
  ChevronRight,
  AlertCircle,
  School,
} from 'lucide-react';
import { useState } from 'react';
import { useCourses, useDeleteCourse, type Course } from '@/hooks/useApi';

export default function CursosPage() {
  const { data: courses, isLoading, error: coursesError } = useCourses();
  const deleteCourse = useDeleteCourse();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este curso y todos sus alumnos?')) return;
    setError(null);
    try {
      await deleteCourse.mutateAsync(id);
    } catch (err: any) {
      setError(
        err?.translatedMessage || err?.detail || 'Error al eliminar el curso. Intenta de nuevo.'
      );
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-secondary">Mis Cursos</h1>
        <p className="text-gray-500">Gestiona tus cursos y alumnos</p>
      </div>

      {/* Error banner */}
      {(error || coursesError) && (
        <div
          className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700"
          role="alert"
        >
          <AlertCircle size={18} className="shrink-0" aria-hidden="true" />
          <span>
            {error ||
              (coursesError as any)?.translatedMessage ||
              (coursesError as any)?.detail ||
              'Error al cargar los cursos.'}
          </span>
          <button
            onClick={() => setError(null)}
            className="ml-auto shrink-0 text-red-500 hover:text-red-700"
            aria-label="Cerrar mensaje de error"
          >
            ✕
          </button>
        </div>
      )}

      {!courses || courses.length === 0 ? (
        <EmptyState
          title="No tienes cursos aún"
          description="Solicita a tu sostenedor que cree los cursos en el panel de RELEVO. Una vez creados, aparecerán aquí."
          icon={<School size={48} />}
        />
      ) : (
        <div className="space-y-3">
          {courses.map((course: Course) => (
            <Card key={course.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen size={24} className="text-brand-primary" />
                  <div>
                    <h3 className="font-semibold">
                      {course.name} — {course.grade}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {course.subject} · {course.student_count} alumnos
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/dashboard/cursos/${course.id}/alumnos`}>
                    <Button
                      brand="tiza"
                      variant="ghost"
                      size="sm"
                      aria-label={`Alumnos de ${course.name}`}
                    >
                      <Users size={16} />
                    </Button>
                  </Link>
                  <Link href={`/dashboard/cursos/${course.id}/stats`}>
                    <Button
                      brand="tiza"
                      variant="ghost"
                      size="sm"
                      aria-label={`Estadísticas de ${course.name}`}
                    >
                      <BarChart3 size={16} />
                    </Button>
                  </Link>
                  <button
                    onClick={() => handleDelete(course.id)}
                    className="p-2 text-gray-400 hover:text-red-500"
                    aria-label={`Eliminar ${course.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                  <ChevronRight size={16} className="text-gray-400" aria-hidden="true" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
