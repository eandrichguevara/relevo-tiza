'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Badge, Spinner, EmptyState, Input, ErrorMessage } from '@tiza/ui';
import { getToken } from '@/lib/auth';
import { Plus, ArrowLeft, Users, Trash2, RefreshCw } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function AlumnosPage() {
  const params = useParams();
  const courseId = params.id as string;
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBulk, setShowBulk] = useState(false);
  const [namesInput, setNamesInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error('No token available');
      const [courseRes, studentsRes] = await Promise.all([
        fetch(`${API_URL}/api/courses/${courseId}`, {
          headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Brand': 'tiza' },
        }),
        fetch(`${API_URL}/api/students/course/${courseId}`, {
          headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Brand': 'tiza' },
        }),
      ]);
      if (!courseRes.ok || !studentsRes.ok) {
        throw new Error('Error al cargar los datos del curso');
      }
      const courseData = await courseRes.json();
      setCourseName(courseData.name || 'Curso');
      const studentsData = await studentsRes.json();
      setStudents(Array.isArray(studentsData) ? studentsData : []);
    } catch (e) {
      const message =
        (e as any)?.translatedMessage ||
        (e as any)?.message ||
        'Error al cargar los alumnos. Intenta de nuevo.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const names = namesInput.split('\n').filter((n) => n.trim());
    if (names.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error('No token available');
      const res = await fetch(`${API_URL}/api/students/course/${courseId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Brand': 'tiza',
        },
        body: JSON.stringify({ names }),
      });
      if (res.ok) {
        setShowBulk(false);
        setNamesInput('');
        fetchStudents();
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.detail || 'Error al agregar alumnos');
      }
    } catch (e) {
      const message =
        (e as any)?.translatedMessage ||
        (e as any)?.message ||
        'Error al agregar alumnos. Intenta de nuevo.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (studentId: string) => {
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error('No token available');
      const res = await fetch(`${API_URL}/api/students/${studentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Brand': 'tiza' },
      });
      if (!res.ok) {
        throw new Error('Error al eliminar el alumno');
      }
      fetchStudents();
    } catch (e) {
      const message =
        (e as any)?.translatedMessage ||
        (e as any)?.message ||
        'Error al eliminar el alumno. Intenta de nuevo.';
      setError(message);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );

  return (
    <div>
      <Link
        href="/dashboard/cursos"
        className="text-brand-primary text-sm hover:underline mb-2 inline-block"
      >
        <ArrowLeft size={14} className="inline mr-1" />
        Volver a cursos
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-secondary">{courseName}</h1>
          <p className="text-gray-500">{students.length} alumnos</p>
        </div>
        <Button brand="tiza" onClick={() => setShowBulk(!showBulk)}>
          <Plus size={16} className="mr-1" />
          Agregar alumnos
        </Button>
      </div>

      {showBulk && (
        <Card className="mb-6">
          <form onSubmit={handleBulkAdd} className="space-y-4">
            <h3 className="font-semibold">Agregar alumnos</h3>
            <p className="text-sm text-gray-500">Escribe un nombre por línea</p>
            <textarea
              value={namesInput}
              onChange={(e) => setNamesInput(e.target.value)}
              rows={5}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Ana Martínez&#10;Benjamín Soto&#10;Catalina Rojas"
            />
            <div className="flex gap-2">
              <Button type="submit" brand="tiza" loading={submitting}>
                Agregar
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowBulk(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-6">
          <ErrorMessage message={error} onDismiss={() => setError(null)} />
          <button
            onClick={() => {
              setError(null);
              fetchStudents();
            }}
            className="mt-2 inline-flex items-center gap-1 text-sm text-brand-primary hover:underline"
          >
            <RefreshCw size={14} />
            Reintentar
          </button>
        </div>
      )}

      {students.length === 0 ? (
        <EmptyState
          title="Sin alumnos"
          description="Agrega alumnos a este curso"
          icon={<Users size={48} />}
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-3 px-4 font-medium text-gray-500">#</th>
                <th className="py-3 px-4 font-medium text-gray-500">Nombre</th>
                <th className="py-3 px-4 font-medium text-gray-500">Código</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s: any, i: number) => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-4 text-gray-400">{i + 1}</td>
                  <td className="py-2 px-4 font-medium">{s.full_name}</td>
                  <td className="py-2 px-4 font-mono text-sm text-gray-500">{s.student_code}</td>
                  <td className="py-2 px-4">
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
