'use client';

import Link from 'next/link';
import { Card, Button, Badge, Spinner, EmptyState } from '@tiza/ui';
import { Plus, Users, BookOpen, Trash2, BarChart3, ChevronRight, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useCourses, useCreateCourse, useDeleteCourse, type Course } from '@/hooks/useApi';

export default function CursosPage() {
  const { data: courses, isLoading, error: coursesError } = useCourses();
  const createCourse = useCreateCourse();
  const deleteCourse = useDeleteCourse();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('1° básico');
  const [subject, setSubject] = useState('Lenguaje');
  const [error, setError] = useState<string | null>(null);

  const GRADES = [
    '1° básico',
    '2° básico',
    '3° básico',
    '4° básico',
    '5° básico',
    '6° básico',
    '7° básico',
    '8° básico',
    'I medio',
    'II medio',
    'III medio',
    'IV medio',
  ];
  const SUBJECTS = ['Lenguaje', 'Matemáticas', 'Ciencias', 'Historia', 'Inglés'];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createCourse.mutateAsync({ name, grade, subject });
      setShowForm(false);
      setName('');
      setGrade('1° básico');
      setSubject('Lenguaje');
    } catch (err: any) {
      setError(
        err?.translatedMessage || err?.detail || 'Error al crear el curso. Intenta de nuevo.'
      );
    }
  };

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-secondary">Mis Cursos</h1>
          <p className="text-gray-500">Gestiona tus cursos y alumnos</p>
        </div>
        <Button brand="tiza" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} className="mr-1" />
          Nuevo curso
        </Button>
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

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <h3 className="font-semibold">Crear nuevo curso</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="course-name" className="block text-sm font-medium mb-1">
                  Nombre del curso
                </label>
                <input
                  id="course-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                  placeholder="5° Básico A"
                  required
                />
              </div>
              <div>
                <label htmlFor="course-grade" className="block text-sm font-medium mb-1">
                  Nivel
                </label>
                <select
                  id="course-grade"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  {GRADES.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="course-subject" className="block text-sm font-medium mb-1">
                  Asignatura
                </label>
                <select
                  id="course-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" brand="tiza" loading={createCourse.isPending}>
                Crear curso
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {!courses || courses.length === 0 ? (
        <EmptyState
          title="No tienes cursos"
          description="Crea tu primer curso para empezar a organizar tus evaluaciones"
          action={
            <Button brand="tiza" onClick={() => setShowForm(true)}>
              <Plus size={16} className="mr-1" />
              Crear curso
            </Button>
          }
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
