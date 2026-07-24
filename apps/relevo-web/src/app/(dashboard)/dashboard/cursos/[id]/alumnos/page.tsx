'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Spinner, EmptyState, ErrorMessage } from '@tiza/ui';
import { Plus, ArrowLeft, Users, Trash2, RefreshCw, X } from 'lucide-react';
import {
  useStudents,
  useBulkCreateStudents,
  useDeleteStudent,
  useCourse,
  type Student,
} from '@/hooks/useRelevoApi';
import ConfirmModal from '@/components/ConfirmModal';

// ─── Format date ──────────────────────────────────────────

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

// ─── Page ─────────────────────────────────────────────────

export default function AlumnosPage() {
  const params = useParams<{ id: string }>();
  const courseId = params?.id ?? null;

  const { data: students, isLoading, error, refetch } = useStudents(courseId);

  const bulkCreateStudents = useBulkCreateStudents();
  const deleteStudent = useDeleteStudent();
  const { data: course } = useCourse(courseId);

  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkNames, setBulkNames] = useState('');
  const [bulkError, setBulkError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);

  // ── Toast helper ─────────────────────────────────────

  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // ── Bulk add handlers ────────────────────────────────

  const handleOpenBulkForm = () => {
    setBulkNames('');
    setBulkError(null);
    setShowBulkForm(true);
  };

  const handleCloseBulkForm = () => {
    setShowBulkForm(false);
    setBulkNames('');
    setBulkError(null);
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkError(null);

    if (!courseId) return;

    const names = bulkNames
      .split('\n')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length === 0) {
      setBulkError('Ingresa al menos un nombre de alumno.');
      return;
    }

    try {
      await bulkCreateStudents.mutateAsync({ courseId, names });
      handleCloseBulkForm();
      showToast(
        `${names.length} alumno${names.length !== 1 ? 's' : ''} agregado${names.length !== 1 ? 's' : ''} exitosamente`,
        'success'
      );
    } catch (err: any) {
      setBulkError(
        err?.translatedMessage || err?.detail || 'Error al agregar alumnos. Intenta de nuevo.'
      );
    }
  };

  // ── Delete handler ───────────────────────────────────

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !courseId) return;
    try {
      await deleteStudent.mutateAsync({ studentId: deleteTarget.id, courseId });
      showToast(`"${deleteTarget.full_name}" eliminado del curso`, 'success');
      setDeleteTarget(null);
    } catch (err: any) {
      showToast(
        err?.translatedMessage || err?.detail || 'Error al eliminar alumno. Intenta de nuevo.',
        'error'
      );
      setDeleteTarget(null);
    }
  };

  // ── Derived state ────────────────────────────────────

  const apiError = error as { translatedMessage?: string } | null;

  return (
    <div>
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
          role="alert"
        >
          {toast.message}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Eliminar alumno"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          confirmLabel="Eliminar"
          confirmVariant="danger"
          loading={deleteStudent.isPending}
        >
          <p>
            ¿Estás seguro de eliminar a <strong>{deleteTarget.full_name}</strong>?
          </p>
          <p className="mt-2 text-gray-500">
            Su código <strong>{deleteTarget.student_code}</strong> quedará liberado. Esta acción no
            se puede deshacer.
          </p>
        </ConfirmModal>
      )}

      {/* ── Header ────────────────────────────────────── */}
      <div className="mb-6">
        <Link
          href="/dashboard/cursos"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-primary transition-colors mb-3"
          aria-label="Volver a cursos"
        >
          <ArrowLeft size={16} />
          Volver a cursos
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-brand-primary">
              {course ? `${course.name} — ${course.grade}` : 'Cargando...'}
            </h1>
            {!isLoading && !error && students && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-0.5 text-sm font-medium text-blue-800">
                <Users size={14} />
                {students.length} alumno{students.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {!showBulkForm && (
            <Button brand="relevo" onClick={handleOpenBulkForm} aria-label="Agregar alumnos">
              <Plus size={16} className="mr-1" />
              Agregar alumnos
            </Button>
          )}
        </div>
        <p className="text-gray-500 mt-1">Gestión de alumnos del curso</p>
      </div>

      {/* ── Loading State ─────────────────────────────── */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* ── Error State ───────────────────────────────── */}
      {!isLoading && error && (
        <div className="space-y-4">
          <ErrorMessage message={apiError?.translatedMessage || 'Error al cargar los alumnos.'} />
          <Button variant="outline" brand="relevo" onClick={() => refetch()}>
            <RefreshCw size={14} className="mr-1" />
            Reintentar
          </Button>
        </div>
      )}

      {/* ── Content (loaded) ──────────────────────────── */}
      {!isLoading && !error && (
        <div className="space-y-6">
          {/* ── Bulk Add Form ─────────────────────────── */}
          {showBulkForm && (
            <Card brand="relevo">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Agregar alumnos</h3>
                <button
                  type="button"
                  onClick={handleCloseBulkForm}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="Cerrar formulario"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleBulkSubmit}>
                <div className="mb-4">
                  <label
                    htmlFor="bulk-names"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Nombres de los alumnos
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Ingresa un nombre por línea. Ejemplo:
                  </p>
                  <textarea
                    id="bulk-names"
                    rows={6}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400
                      focus:outline-none focus:ring-2 focus:ring-[#1A3A5C] focus:ring-offset-1 resize-y"
                    placeholder="Ana Martínez
Benjamín Soto
Catalina Rojas
Diego Valenzuela
Emilia Torres"
                    value={bulkNames}
                    onChange={(e) => setBulkNames(e.target.value)}
                    aria-label="Nombres de alumnos (uno por línea)"
                  />
                  {bulkNames.trim() && (
                    <p className="mt-1.5 text-xs text-gray-400">
                      {bulkNames.split('\n').filter((n) => n.trim()).length} alumno
                      {bulkNames.split('\n').filter((n) => n.trim()).length !== 1 ? 's' : ''}{' '}
                      detectado
                      {bulkNames.split('\n').filter((n) => n.trim()).length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {bulkError && (
                  <div className="mb-4">
                    <ErrorMessage message={bulkError} />
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="ghost" onClick={handleCloseBulkForm}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    brand="relevo"
                    loading={bulkCreateStudents.isPending}
                    disabled={!bulkNames.trim()}
                  >
                    <Plus size={16} className="mr-1" />
                    Agregar
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* ── Empty State ───────────────────────────── */}
          {!showBulkForm && students && students.length === 0 && (
            <EmptyState
              title="Sin alumnos"
              description="Agrega alumnos a este curso"
              icon={<Users size={48} />}
              action={
                <Button brand="relevo" onClick={handleOpenBulkForm}>
                  <Plus size={16} className="mr-1" />
                  Agregar alumnos
                </Button>
              }
            />
          )}

          {/* ── Students Table ────────────────────────── */}
          {students && students.length > 0 && (
            <Card brand="relevo" padding="none">
              {/* Mobile card header */}
              <div className="px-4 py-3 border-b border-gray-100 sm:hidden">
                <p className="text-sm font-medium text-gray-500">
                  {students.length} alumno{students.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Desktop table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table" aria-label="Lista de alumnos">
                  <thead className="hidden sm:table-header-group">
                    <tr className="border-b border-gray-200 text-left">
                      <th className="py-3 px-4 font-medium text-gray-500 w-12">#</th>
                      <th className="py-3 px-4 font-medium text-gray-500">Nombre</th>
                      <th className="py-3 px-4 font-medium text-gray-500">Código</th>
                      <th className="py-3 px-4 font-medium text-gray-500 hidden md:table-cell">
                        Fecha de registro
                      </th>
                      <th className="py-3 px-4 font-medium text-gray-500 w-16">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, index) => (
                      <tr
                        key={student.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        {/* Desktop cells */}
                        <td className="hidden sm:table-cell py-3 px-4 text-gray-400 text-xs font-mono">
                          {index + 1}
                        </td>
                        <td className="hidden sm:table-cell py-3 px-4">
                          <span className="font-medium text-gray-900">{student.full_name}</span>
                          {student.rut && (
                            <span className="ml-2 text-xs text-gray-400">{student.rut}</span>
                          )}
                        </td>
                        <td className="hidden sm:table-cell py-3 px-4">
                          <code className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-600 tracking-wider">
                            {student.student_code}
                          </code>
                        </td>
                        <td className="hidden md:table-cell py-3 px-4 text-gray-400 text-xs">
                          {formatDate(student.created_at)}
                        </td>
                        <td className="hidden sm:table-cell py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(student)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            aria-label={`Eliminar a ${student.full_name}`}
                            title="Eliminar alumno"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>

                        {/* Mobile card row */}
                        <td className="sm:hidden py-3 px-4">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-900 truncate">
                                {student.full_name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-mono text-gray-500">
                                  {student.student_code}
                                </code>
                                {student.rut && (
                                  <span className="text-[11px] text-gray-400">{student.rut}</span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(student)}
                              className="ml-2 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
                              aria-label={`Eliminar a ${student.full_name}`}
                              title="Eliminar alumno"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table footer */}
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                <span>
                  {students.length} alumno{students.length !== 1 ? 's' : ''} en total
                </span>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="inline-flex items-center gap-1 text-brand-primary hover:underline"
                  aria-label="Actualizar lista"
                >
                  <RefreshCw size={12} />
                  Actualizar
                </button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
