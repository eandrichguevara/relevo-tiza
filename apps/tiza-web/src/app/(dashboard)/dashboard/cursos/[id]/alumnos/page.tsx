'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, Spinner, EmptyState, ErrorMessage } from '@tiza/ui';
import { getToken } from '@/lib/auth';
import { ArrowLeft, Users, RefreshCw } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function AlumnosPage() {
  const params = useParams();
  const courseId = params.id as string;
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-secondary">{courseName}</h1>
        <p className="text-gray-500">{students.length} alumnos</p>
        <p className="text-sm text-gray-400 mt-1">Vista de alumnos del curso</p>
      </div>

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
          description="No hay alumnos registrados en este curso"
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
              </tr>
            </thead>
            <tbody>
              {students.map((s: any, i: number) => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-4 text-gray-400">{i + 1}</td>
                  <td className="py-2 px-4 font-medium">{s.full_name}</td>
                  <td className="py-2 px-4 font-mono text-sm text-gray-500">{s.student_code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
