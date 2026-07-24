'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, Button, Input, Badge, Spinner, EmptyState, ErrorMessage } from '@tiza/ui';
import {
  BookOpen,
  Plus,
  Trash2,
  X,
  School,
  Users,
  RefreshCw,
  GraduationCap,
  Check,
} from 'lucide-react';
import {
  useTenants,
  useCourses,
  useCreateCourse,
  useDeleteCourse,
  useUsers,
  type Course,
} from '@/hooks/useRelevoApi';
import { useActiveTenant } from '@/hooks/ActiveTenantContext';
import { formatTenantDomain } from '@/lib/domain';
import ConfirmModal from '@/components/ConfirmModal';

// ─── Niveles disponibles ──────────────────────────────────

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

// ─── Asignaturas disponibles ──────────────────────────────

const SUBJECTS = ['Lenguaje', 'Matemáticas'];

// ─── Format date ──────────────────────────────────────────

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

// ─── Main content ─────────────────────────────────────────

function CursosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedTenantId = searchParams.get('tenant_id');

  const { activeTenantId: contextTenantId, setActiveTenantId: setContextTenantId } =
    useActiveTenant();

  const { data: tenants, isLoading: tenantsLoading } = useTenants();

  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(
    preselectedTenantId || contextTenantId
  );

  // Sync from context on mount/change (if no URL param override)
  useEffect(() => {
    if (!preselectedTenantId && contextTenantId && contextTenantId !== selectedTenantId) {
      setSelectedTenantId(contextTenantId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextTenantId]);

  const {
    data: courses,
    isLoading: coursesLoading,
    error: coursesError,
    refetch: refetchCourses,
  } = useCourses(selectedTenantId);

  const createCourse = useCreateCourse();
  const deleteCourse = useDeleteCourse();
  const { data: users } = useUsers(selectedTenantId);
  const teachers = useMemo(
    () => (users || []).filter((u: any) => u.role === 'TEACHER' && u.status === 'active'),
    [users]
  );

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', grade: GRADES[0] });
  const [subjects, setSubjects] = useState<string[]>(['Lenguaje', 'Matemáticas']);
  const [selectedTeachers, setSelectedTeachers] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const selectedTenant = useMemo(
    () => tenants?.find((t) => t.id === selectedTenantId),
    [tenants, selectedTenantId]
  );

  // ── Toast helper ─────────────────────────────────────

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Modal handlers ───────────────────────────────────

  const handleOpenModal = () => {
    setForm({ name: '', grade: GRADES[0] });
    setSubjects(['Lenguaje', 'Matemáticas']);
    setSelectedTeachers({});
    setFormError(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormError(null);
    setSelectedTeachers({});
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = form.name.trim();

    if (!name) {
      setFormError('El nombre del curso es obligatorio.');
      return;
    }

    if (subjects.length === 0) {
      setFormError('Selecciona al menos una asignatura.');
      return;
    }

    // Validate each selected subject has a teacher assigned
    const missingTeachers = subjects.filter((s) => !selectedTeachers[s]);
    if (missingTeachers.length > 0) {
      setFormError(`Selecciona un profesor para: ${missingTeachers.join(', ')}.`);
      return;
    }

    if (!selectedTenantId) {
      setFormError('Selecciona un colegio primero.');
      return;
    }

    try {
      await createCourse.mutateAsync({
        name,
        grade: form.grade,
        subject: subjects.join(', '),
        teachers: subjects.reduce(
          (acc, s) => ({ ...acc, [s]: selectedTeachers[s] }),
          {} as Record<string, string>
        ),
        tenant_id: selectedTenantId,
      });
      handleCloseModal();
      showToast(`Curso "${name}" creado exitosamente`, 'success');
    } catch (err: any) {
      setFormError(
        err?.translatedMessage || err?.detail || 'Error al crear el curso. Intenta de nuevo.'
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCourse.mutateAsync(deleteTarget.id);
      showToast(`Curso "${deleteTarget.name}" eliminado`, 'success');
      setDeleteTarget(null);
    } catch (err: any) {
      showToast(
        err?.translatedMessage || err?.detail || 'Error al eliminar el curso. Intenta de nuevo.',
        'error'
      );
      setDeleteTarget(null);
    }
  };

  // ── Tenant selection ──────────────────────────────────

  const handleTenantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedTenantId(value || null);

    if (value) {
      setContextTenantId(value);
    }

    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('tenant_id', value);
    } else {
      params.delete('tenant_id');
    }
    router.replace(`/dashboard/cursos?${params.toString()}`, { scroll: false });
  };

  // ── Subject toggle ────────────────────────────────────

  const toggleSubject = (subject: string) => {
    setSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    );
  };

  const coursesErrorObj = coursesError as { translatedMessage?: string } | null;

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
          title="Eliminar curso"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmLabel="Eliminar"
          confirmVariant="danger"
          loading={deleteCourse.isPending}
        >
          <p>
            ¿Estás seguro de eliminar <strong>{deleteTarget.name}</strong> ({deleteTarget.grade})?
          </p>
          <p className="mt-2 text-gray-500">
            Todos los alumnos y evaluaciones asociados a este curso serán eliminados. Esta acción no
            se puede deshacer.
          </p>
        </ConfirmModal>
      )}

      {/* ── Header ────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Cursos</h1>
          <p className="text-gray-500">Gestiona los cursos de tus colegios</p>
        </div>
        <Button
          brand="relevo"
          onClick={handleOpenModal}
          disabled={!selectedTenantId}
          aria-label="Nuevo curso"
        >
          <Plus size={16} className="mr-1" />
          Nuevo curso
        </Button>
      </div>

      {/* ── Tenant Selector ───────────────────────────── */}
      <Card brand="relevo" padding="sm" className="mb-6">
        <div className="flex items-center gap-3">
          <label
            htmlFor="tenant-select"
            className="text-sm font-medium text-gray-700 whitespace-nowrap"
          >
            Colegio:
          </label>
          {tenantsLoading ? (
            <Spinner size="sm" />
          ) : (
            <select
              id="tenant-select"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-[#1A3A5C] focus:ring-offset-1
                bg-white"
              value={selectedTenantId || ''}
              onChange={handleTenantChange}
              aria-label="Seleccionar colegio"
            >
              <option value="">— Selecciona un colegio —</option>
              {tenants?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {selectedTenant && <Badge variant="info">{formatTenantDomain(selectedTenant)}</Badge>}
        </div>
      </Card>

      {/* ── No tenant selected ────────────────────────── */}
      {!selectedTenantId && !tenantsLoading && (
        <EmptyState
          title="Selecciona un colegio"
          description="Elige un colegio del selector para ver sus cursos."
          icon={<School size={48} />}
        />
      )}

      {/* ── Loading courses ───────────────────────────── */}
      {selectedTenantId && coursesLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* ── Courses error ─────────────────────────────── */}
      {selectedTenantId && !coursesLoading && coursesError && (
        <div className="space-y-4">
          <ErrorMessage
            message={coursesErrorObj?.translatedMessage || 'Error al cargar los cursos.'}
          />
          <Button variant="outline" brand="relevo" onClick={() => refetchCourses()}>
            <RefreshCw size={14} className="mr-1" />
            Reintentar
          </Button>
        </div>
      )}

      {/* ── Empty courses ─────────────────────────────── */}
      {selectedTenantId && !coursesLoading && !coursesError && courses && courses.length === 0 && (
        <EmptyState
          title="No hay cursos en este colegio"
          description="Crea el primer curso para empezar a trabajar."
          icon={<GraduationCap size={48} />}
          action={
            <Button brand="relevo" onClick={handleOpenModal}>
              <Plus size={16} className="mr-1" />
              Crear curso
            </Button>
          }
        />
      )}

      {/* ── Courses list ──────────────────────────────── */}
      {selectedTenantId && !coursesLoading && !coursesError && courses && courses.length > 0 && (
        <div className="space-y-3" role="list" aria-label="Lista de cursos">
          {courses.map((course: Course) => (
            <Card key={course.id} brand="relevo">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand-light flex items-center justify-center">
                    <BookOpen className="text-brand-primary" size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {course.name} — {course.grade}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">{course.subject}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      <Users size={12} className="inline mr-1" />
                      {course.student_count} alumnos · Creado {formatDate(course.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link href={`/dashboard/cursos/${course.id}/alumnos`} prefetch={false}>
                    <Button
                      variant="outline"
                      brand="relevo"
                      size="sm"
                      aria-label={`Gestionar alumnos de ${course.name}`}
                    >
                      <Users size={14} className="mr-1" />
                      Alumnos
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    brand="relevo"
                    size="sm"
                    onClick={() => setDeleteTarget(course)}
                    aria-label={`Eliminar ${course.name}`}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create Course Modal ───────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={handleCloseModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="course-modal-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-2">
              <h2 id="course-modal-title" className="text-xl font-bold text-brand-primary">
                Nuevo curso
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Cerrar modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleCreate}>
              <div className="px-6 py-4 space-y-4">
                {/* Selected school info */}
                {selectedTenant && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    <School size={14} />
                    <span>
                      Agregando a: <strong>{selectedTenant.name}</strong>
                    </span>
                  </div>
                )}

                {/* Course name */}
                <Input
                  label="Nombre del curso"
                  placeholder="Nombre del curso"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />

                {/* Grade select */}
                <div>
                  <label
                    htmlFor="course-grade"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Nivel
                  </label>
                  <select
                    id="course-grade"
                    value={form.grade}
                    onChange={(e) => setForm({ ...form, grade: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900
                      focus:outline-none focus:ring-2 focus:ring-[#1A3A5C] focus:ring-offset-1 bg-white"
                    aria-label="Seleccionar nivel"
                  >
                    {GRADES.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </div>

                {/* Subjects multi-select */}
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-2">Asignaturas</span>
                  <div
                    className="grid grid-cols-2 gap-2"
                    role="group"
                    aria-label="Seleccionar asignaturas"
                  >
                    {SUBJECTS.map((subject) => {
                      const isSelected = subjects.includes(subject);
                      return (
                        <label
                          key={subject}
                          className={`flex items-center gap-2 cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors ${
                            isSelected
                              ? 'border-brand-primary bg-brand-light/50 text-brand-primary'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSubject(subject)}
                            className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                          />
                          <span>{subject}</span>
                        </label>
                      );
                    })}
                  </div>
                  {subjects.length > 0 && (
                    <p className="mt-2 text-xs text-gray-400">
                      <Check size={12} className="inline mr-0.5" />
                      {subjects.length} asignatura{subjects.length !== 1 ? 's' : ''} seleccionada
                      {subjects.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Teacher per subject */}
                {subjects.length > 0 && (
                  <div className="space-y-3">
                    <span className="block text-sm font-medium text-gray-700">
                      Profesores por asignatura
                    </span>
                    {subjects.map((subject) => (
                      <div key={subject}>
                        <label
                          htmlFor={`course-teacher-${subject}`}
                          className="block text-xs font-medium text-gray-500 mb-1"
                        >
                          {subject}
                        </label>
                        {teachers && teachers.length > 0 ? (
                          <select
                            id={`course-teacher-${subject}`}
                            value={selectedTeachers[subject] || ''}
                            onChange={(e) =>
                              setSelectedTeachers((prev) => ({
                                ...prev,
                                [subject]: e.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900
                              focus:outline-none focus:ring-2 focus:ring-[#1A3A5C] focus:ring-offset-1 bg-white"
                            aria-label={`Seleccionar profesor para ${subject}`}
                          >
                            <option value="">— Selecciona profesor —</option>
                            {teachers.map((t: any) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                            No hay profesores disponibles en este colegio.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Error message */}
              {formError && (
                <div className="px-6 mb-2">
                  <ErrorMessage message={formError} />
                </div>
              )}

              {/* Footer */}
              <div className="flex justify-end gap-3 px-6 pb-6 pt-2">
                <Button type="button" variant="ghost" onClick={handleCloseModal}>
                  Cancelar
                </Button>
                <Button type="submit" brand="relevo" loading={createCourse.isPending}>
                  Crear curso
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page wrapper with Suspense (for useSearchParams) ────

export default function CursosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      }
    >
      <CursosContent />
    </Suspense>
  );
}
