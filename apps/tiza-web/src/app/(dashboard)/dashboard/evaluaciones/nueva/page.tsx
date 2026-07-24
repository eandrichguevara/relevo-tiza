'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Input, Button, Spinner } from '@tiza/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useCreateEvaluation, useMyClasses, type TeacherClass } from '@/hooks/useApi';

interface CriterionLevel {
  points: number;
  description: string;
}

interface CriterionItem {
  name: string;
  levels: CriterionLevel[];
}

interface AlternativeItem {
  label: string;
  text: string;
  is_correct: boolean;
}

interface Question {
  question_number: number;
  statement: string;
  type: 'written' | 'multiple_choice';
  max_score?: number;
  correct_answer: string;
  criteria: CriterionItem[];
  alternatives?: AlternativeItem[];
}

export default function NuevaEvaluacionPage() {
  const router = useRouter();
  const createEval = useCreateEvaluation();
  const { data: myClasses, isLoading: classesLoading } = useMyClasses();
  const [title, setTitle] = useState('');
  const [selectedClass, setSelectedClass] = useState<TeacherClass | null>(null);
  const [questions, setQuestions] = useState<Question[]>([
    {
      question_number: 1,
      statement: '',
      type: 'written',
      correct_answer: '',
      criteria: [],
      alternatives: undefined,
    },
  ]);

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        question_number: prev.length + 1,
        statement: '',
        type: 'written',
        correct_answer: '',
        criteria: [],
        alternatives: undefined,
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) =>
      prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, question_number: i + 1 }))
    );
  };

  // ─── Alternative helpers ──────────────────────────────
  const initAlternatives = (): AlternativeItem[] => [
    { label: 'A', text: '', is_correct: false },
    { label: 'B', text: '', is_correct: false },
  ];

  const addAlternative = (qIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        const alts = q.alternatives || [];
        if (alts.length >= 6) return q;
        const nextLabel = String.fromCharCode(65 + alts.length);
        return {
          ...q,
          alternatives: [...alts, { label: nextLabel, text: '', is_correct: false }],
        };
      })
    );
  };

  const removeAlternative = (qIndex: number, altIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        const alts = (q.alternatives || []).filter((_, j) => j !== altIndex);
        return {
          ...q,
          alternatives: alts.map((a, j) => ({ ...a, label: String.fromCharCode(65 + j) })),
        };
      })
    );
  };

  const updateAlternativeText = (qIndex: number, altIndex: number, text: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        return {
          ...q,
          alternatives: (q.alternatives || []).map((a, j) => (j === altIndex ? { ...a, text } : a)),
        };
      })
    );
  };

  const toggleCorrectAlternative = (qIndex: number, altIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        return {
          ...q,
          alternatives: (q.alternatives || []).map((a, j) => ({
            ...a,
            is_correct: j === altIndex,
          })),
        };
      })
    );
  };

  // ─── Criteria helpers ──────────────────────────────
  // Agregar un nuevo criterio (con 1 nivel por defecto)
  const addCriterion = (qIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        return {
          ...q,
          criteria: [...q.criteria, { name: '', levels: [{ points: 3, description: '' }] }],
        };
      })
    );
  };

  // Eliminar un criterio
  const removeCriterion = (qIndex: number, cIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        return { ...q, criteria: q.criteria.filter((_, ci) => ci !== cIndex) };
      })
    );
  };

  // Actualizar nombre del criterio
  const updateCriterionName = (qIndex: number, cIndex: number, name: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        return {
          ...q,
          criteria: q.criteria.map((c, ci) => (ci === cIndex ? { ...c, name } : c)),
        };
      })
    );
  };

  // Agregar un nivel a un criterio
  const addCriterionLevel = (qIndex: number, cIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        return {
          ...q,
          criteria: q.criteria.map((c, ci) => {
            if (ci !== cIndex) return c;
            const lastPoints =
              c.levels.length > 0 ? Math.max(0, c.levels[c.levels.length - 1].points - 1) : 1;
            return {
              ...c,
              levels: [...c.levels, { points: lastPoints, description: '' }],
            };
          }),
        };
      })
    );
  };

  // Eliminar un nivel de un criterio
  const removeCriterionLevel = (qIndex: number, cIndex: number, lIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        return {
          ...q,
          criteria: q.criteria.map((c, ci) => {
            if (ci !== cIndex) return c;
            return { ...c, levels: c.levels.filter((_, li) => li !== lIndex) };
          }),
        };
      })
    );
  };

  // Actualizar un nivel
  const updateCriterionLevel = (
    qIndex: number,
    cIndex: number,
    lIndex: number,
    field: 'points' | 'description',
    value: string | number
  ) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        return {
          ...q,
          criteria: q.criteria.map((c, ci) => {
            if (ci !== cIndex) return c;
            return {
              ...c,
              levels: c.levels.map((l, li) =>
                li === lIndex ? { ...l, [field]: field === 'points' ? Number(value) : value } : l
              ),
            };
          }),
        };
      })
    );
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== index) return q;
        if (field === 'type' && value === 'multiple_choice') {
          return { ...q, type: value, alternatives: q.alternatives || initAlternatives() };
        }
        if (field === 'type' && value === 'written') {
          return { ...q, type: value, alternatives: undefined };
        }
        return { ...q, [field]: value };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) {
      alert('Selecciona una clase para la evaluación.');
      return;
    }

    // Validate alternatives for multiple_choice questions
    for (const q of questions) {
      if (q.type === 'multiple_choice') {
        const alts = q.alternatives || [];
        if (alts.length < 2) {
          alert(`Pregunta ${q.question_number}: debe tener al menos 2 alternativas.`);
          return;
        }
        const correctCount = alts.filter((a) => a.is_correct).length;
        if (correctCount === 0) {
          alert(`Pregunta ${q.question_number}: selecciona la alternativa correcta.`);
          return;
        }
        if (correctCount > 1) {
          alert(`Pregunta ${q.question_number}: solo puede haber una alternativa correcta.`);
          return;
        }
      }

      // Validate criteria for written questions
      if (q.type === 'written' && q.criteria.length > 0) {
        for (const criterion of q.criteria) {
          if (!criterion.name.trim()) {
            alert(`Pregunta ${q.question_number}: todos los criterios deben tener nombre.`);
            return;
          }
          if (criterion.levels.length === 0) {
            alert(
              `Pregunta ${q.question_number}: el criterio "${criterion.name}" debe tener al menos un nivel.`
            );
            return;
          }
          for (const level of criterion.levels) {
            if (level.points <= 0) {
              alert(
                `Pregunta ${q.question_number}, criterio "${criterion.name}": cada nivel debe tener puntaje > 0.`
              );
              return;
            }
            if (!level.description.trim()) {
              alert(
                `Pregunta ${q.question_number}, criterio "${criterion.name}": cada nivel debe tener descripción.`
              );
              return;
            }
          }
        }
      }
    }

    try {
      const rubric = questions.map((q) => {
        const base = {
          ...q,
          criteria: q.criteria.length > 0 ? q.criteria : undefined,
        };
        // No enviamos max_score para written — el backend lo calcula
        if (q.type === 'written') {
          delete (base as any).max_score;
        }
        return base;
      });

      await createEval.mutateAsync({
        title,
        subject: selectedClass.subject,
        grade: selectedClass.grade,
        course_id: selectedClass.course_id,
        rubric,
      });
      router.push('/dashboard/evaluaciones');
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-secondary mb-6">Nueva evaluación</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Título de la evaluación"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Prueba diagnóstica primer semestre"
              required
            />
            <div>
              <label htmlFor="class" className="block text-sm font-medium text-gray-700 mb-1">
                Clase {classesLoading && <Spinner size="sm" />}
              </label>
              <select
                id="class"
                value={selectedClass ? `${selectedClass.course_id}|${selectedClass.subject}` : ''}
                onChange={(e) => {
                  const [course_id, subject] = e.target.value.split('|');
                  const found = myClasses?.find(
                    (c) => c.course_id === course_id && c.subject === subject
                  );
                  setSelectedClass(found || null);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                required
              >
                <option value="">Selecciona una clase</option>
                {myClasses?.map((c) => (
                  <option key={`${c.course_id}|${c.subject}`} value={`${c.course_id}|${c.subject}`}>
                    {c.grade} — {c.course_name} ({c.subject})
                  </option>
                ))}
              </select>
              {myClasses?.length === 0 && !classesLoading && (
                <p className="mt-1 text-xs text-amber-600">
                  No tienes clases asignadas. Contacta al administrador.
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card title="Rúbrica de preguntas" subtitle="Define cada pregunta y su puntaje">
          <div className="space-y-4">
            {questions.map((q, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-brand-primary mt-2">Q{q.question_number}</span>
                <div className="flex-1 space-y-2">
                  <textarea
                    value={q.statement}
                    onChange={(e) => updateQuestion(index, 'statement', e.target.value)}
                    placeholder="Enunciado de la pregunta"
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary resize-y"
                  />
                  <div className="flex gap-3">
                    <select
                      value={q.type}
                      onChange={(e) => updateQuestion(index, 'type', e.target.value)}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                      aria-label={`Tipo de pregunta ${q.question_number}`}
                    >
                      <option value="written">Desarrollo</option>
                      <option value="multiple_choice">Alternativas</option>
                    </select>
                    {q.type === 'multiple_choice' && (
                      <div className="w-40">
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Puntaje máximo
                        </label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={q.max_score || ''}
                          onChange={(e) =>
                            updateQuestion(index, 'max_score', Number(e.target.value))
                          }
                          placeholder="Pts"
                        />
                        <div className="flex flex-wrap gap-1 mt-1">
                          {[1, 2, 3, 4, 5, 10].map((pts) => (
                            <button
                              key={pts}
                              type="button"
                              onClick={() => updateQuestion(index, 'max_score', pts)}
                              className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                                q.max_score === pts
                                  ? 'bg-brand-primary text-white border-brand-primary'
                                  : 'bg-white text-gray-600 border-gray-300 hover:border-brand-primary hover:text-brand-primary'
                              }`}
                              aria-label={`${pts} puntos`}
                            >
                              {pts}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {q.type === 'written' && q.criteria.length > 0 && (
                      <div className="flex items-center gap-1 text-sm text-gray-500 self-end pb-1">
                        <span>
                          Total:{' '}
                          {q.criteria.reduce(
                            (sum, c) =>
                              sum +
                              (c.levels.length > 0
                                ? Math.max(...c.levels.map((l) => l.points || 0))
                                : 0),
                            0
                          )}{' '}
                          pts
                        </span>
                      </div>
                    )}
                    {q.type === 'multiple_choice' && (
                      <div className="flex-1 space-y-2">
                        <label className="text-sm font-medium text-gray-700">Alternativas</label>
                        {(q.alternatives || []).length === 0 ? (
                          <p className="text-xs text-gray-400">Agrega al menos 2 alternativas.</p>
                        ) : (
                          (q.alternatives || []).map((alt, ai) => (
                            <div key={ai} className="flex items-center gap-2">
                              <span className="w-6 text-sm font-bold text-gray-500">
                                {alt.label}
                              </span>
                              <input
                                type="text"
                                value={alt.text}
                                onChange={(e) => updateAlternativeText(index, ai, e.target.value)}
                                placeholder={`Alternativa ${alt.label}`}
                                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                              />
                              <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={alt.is_correct}
                                  onChange={() => toggleCorrectAlternative(index, ai)}
                                  className="rounded"
                                />
                                Correcta
                              </label>
                              {(q.alternatives || []).length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => removeAlternative(index, ai)}
                                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                  aria-label={`Eliminar alternativa ${alt.label}`}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          ))
                        )}
                        {(q.alternatives || []).length < 6 &&
                          (q.alternatives || []).length >= 2 && (
                            <button
                              type="button"
                              onClick={() => addAlternative(index)}
                              className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              + Agregar alternativa
                            </button>
                          )}
                      </div>
                    )}
                  </div>
                  {q.type === 'written' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">
                          Criterios de evaluación
                        </label>
                        {q.criteria.length > 0 && (
                          <span className="text-xs text-gray-500">
                            Total máx:{' '}
                            {q.criteria.reduce(
                              (sum, c) =>
                                sum +
                                (c.levels.length > 0
                                  ? Math.max(...c.levels.map((l) => l.points || 0))
                                  : 0),
                              0
                            )}{' '}
                            pts
                          </span>
                        )}
                      </div>

                      {q.criteria.length === 0 && (
                        <p className="text-xs text-gray-400">Sin criterios definidos.</p>
                      )}

                      {q.criteria.map((criterion, ci) => (
                        <div key={ci} className="border border-gray-200 rounded-lg bg-white p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold text-gray-400">C{ci + 1}</span>
                            <input
                              type="text"
                              value={criterion.name}
                              onChange={(e) => updateCriterionName(index, ci, e.target.value)}
                              placeholder="Nombre del criterio (ej: Ortografía)"
                              className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            />
                            <button
                              type="button"
                              onClick={() => removeCriterion(index, ci)}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                              aria-label={`Eliminar criterio ${ci + 1}`}
                            >
                              ✕
                            </button>
                          </div>

                          {/* Niveles del criterio */}
                          <div className="space-y-1.5 ml-5">
                            {criterion.levels.map((level, li) => (
                              <div key={li} className="flex items-start gap-2">
                                <span className="text-xs text-gray-400 mt-2 w-5 shrink-0">
                                  {li === 0 ? '🏆' : li === 1 ? '🥈' : li === 2 ? '🥉' : '  •'}
                                </span>
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={level.points}
                                    onChange={(e) =>
                                      updateCriterionLevel(index, ci, li, 'points', e.target.value)
                                    }
                                    className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                    placeholder="Pts"
                                  />
                                  <span className="text-xs text-gray-400 shrink-0">pts —</span>
                                  <input
                                    type="text"
                                    value={level.description}
                                    onChange={(e) =>
                                      updateCriterionLevel(
                                        index,
                                        ci,
                                        li,
                                        'description',
                                        e.target.value
                                      )
                                    }
                                    placeholder="Descripción del nivel"
                                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                  />
                                  {criterion.levels.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => removeCriterionLevel(index, ci, li)}
                                      className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                                      aria-label={`Eliminar nivel ${li + 1}`}
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => addCriterionLevel(index, ci)}
                              className="text-xs text-blue-600 hover:text-blue-800 transition-colors mt-1"
                            >
                              + Agregar nivel
                            </button>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => addCriterion(index)}
                        className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        + Agregar criterio
                      </button>
                    </div>
                  )}
                </div>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(index)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    aria-label={`Eliminar pregunta ${q.question_number}`}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addQuestion}
            className="mt-4 flex items-center gap-2 text-brand-primary hover:text-brand-accent text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Agregar pregunta
          </button>
        </Card>

        <div className="flex gap-4">
          <Button type="button" variant="ghost" brand="tiza" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" brand="tiza" loading={createEval.isPending}>
            Crear evaluación
          </Button>
        </div>
      </form>
    </div>
  );
}
