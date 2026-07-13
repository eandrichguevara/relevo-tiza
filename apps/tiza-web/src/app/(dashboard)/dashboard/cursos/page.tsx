'use client';

import Link from 'next/link';
import { Card, Button, Badge, Spinner, EmptyState } from '@tiza/ui';
import { Plus, Users, BookOpen, Trash2, BarChart3, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function CursosPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('1° básico');
  const [subject, setSubject] = useState('Lenguaje');
  const [submitting, setSubmitting] = useState(false);

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

  const fetchCourses = async () => {
    try {
      const session = await fetch('/api/auth/session').then((r) => r.json());
      const token = (session as any)?.accessToken;
      const res = await fetch(`${API_URL}/api/courses`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Brand': 'tiza' },
      });
      const data = await res.json();
      setCourses(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useState(() => {
    fetchCourses();
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const session = await fetch('/api/auth/session').then((r) => r.json());
      const token = (session as any)?.accessToken;
      const res = await fetch(`${API_URL}/api/courses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Brand': 'tiza',
        },
        body: JSON.stringify({ name, grade, subject }),
      });
      if (res.ok) {
        setShowForm(false);
        setName('');
        fetchCourses();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este curso y todos sus alumnos?')) return;
    const session = await fetch('/api/auth/session').then((r) => r.json());
    const token = (session as any)?.accessToken;
    await fetch(`${API_URL}/api/courses/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Brand': 'tiza' },
    });
    fetchCourses();
  };

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );

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

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <h3 className="font-semibold">Crear nuevo curso</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre del curso</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                  placeholder="5° Básico A"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nivel</label>
                <select
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
                <label className="block text-sm font-medium mb-1">Asignatura</label>
                <select
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
              <Button type="submit" brand="tiza" loading={submitting}>
                Crear curso
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {courses.length === 0 ? (
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
          {courses.map((course: any) => (
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
                    <Button brand="tiza" variant="ghost" size="sm">
                      <Users size={16} />
                    </Button>
                  </Link>
                  <Link href={`/dashboard/cursos/${course.id}/stats`}>
                    <Button brand="tiza" variant="ghost" size="sm">
                      <BarChart3 size={16} />
                    </Button>
                  </Link>
                  <button
                    onClick={() => handleDelete(course.id)}
                    className="p-2 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
