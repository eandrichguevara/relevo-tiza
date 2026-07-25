'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Input, Button, Spinner } from '@tiza/ui';
import { Plus, Trash2, FileText, Image as ImageIcon, HelpCircle, ArrowUp, ArrowDown } from 'lucide-react';
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

type ItemType = 'question' | 'info_section' | 'divider';

interface EvaluationItem {
  id: string; // único para react keys
  item_type: ItemType;
  // Campos para pregunta
  question_number?: number;
  statement?: string;
  type?: 'written' | 'multiple_choice';
  max_score?: number;
  correct_answer?: string;
  criteria?: CriterionItem[];
  alternatives?: AlternativeItem[];
  // Campos para sección informativa
  section_title?: string;
  section_content?: string;
  section_image_url?: string;
}

export default function NuevaEvaluacionPage() {
  const router = useRouter();
  const createEval = useCreateEvaluation();
  const { data: myClasses, isLoading: classesLoading } = useMyClasses();
  const [title, setTitle] = useState('');
  const [selectedClass, setSelectedClass] = useState<TeacherClass | null>(null);

  const createDefaultWrittenQuestion = (id: string, qNum?: number): EvaluationItem => ({
    id,
    item_type: 'question',
    question_number: qNum,
    statement: '',
    type: 'written',
    correct_answer: '',
    criteria: [{ name: '', levels: [{ points: 3, description: '' }] }],
  });

  const createDefaultInfoSection = (id: string): EvaluationItem => ({
    id,
    item_type: 'info_section',
    section_title: '',
    section_content: '',
    section_image_url: '',
  });

  const createDefaultDivider = (id: string): EvaluationItem => ({
    id,
    item_type: 'divider',
    section_title: '',
  });

  const [items, setItems] = useState<EvaluationItem[]>([
    createDefaultInfoSection('item-1'),
    createDefaultWrittenQuestion('item-2', 1),
  ]);

  // Recalcular el número consecutivo de cada pregunta según su posición en la lista de items
  const recomputeQuestionNumbers = (list: EvaluationItem[]): EvaluationItem[] => {
    let qCount = 0;
    return list.map((item) => {
      if (item.item_type === 'question') {
        qCount++;
        return { ...item, question_number: qCount };
      }
      return item;
    });
  };

  const addQuestion = () => {
    setItems((prev) => {
      const newItem = createDefaultWrittenQuestion(`item-${Date.now()}-${Math.random()}`);
      return recomputeQuestionNumbers([...prev, newItem]);
    });
  };

  const addInfoSection = () => {
    setItems((prev) => {
      const newItem = createDefaultInfoSection(`item-${Date.now()}-${Math.random()}`);
      return recomputeQuestionNumbers([...prev, newItem]);
    });
  };

  const addDivider = () => {
    setItems((prev) => {
      const newItem = createDefaultDivider(`item-${Date.now()}-${Math.random()}`);
      return recomputeQuestionNumbers([...prev, newItem]);
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => recomputeQuestionNumbers(prev.filter((it) => it.id !== id)));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    setItems((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const newList = [...prev];
      const temp = newList[index];
      newList[index] = newList[targetIndex];
      newList[targetIndex] = temp;
      return recomputeQuestionNumbers(newList);
    });
  };

  // ─── Item update helper ──────────────────────────────
  const updateItem = (id: string, updates: Partial<EvaluationItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (updates.type === 'multiple_choice' && !item.alternatives) {
          return {
            ...item,
            ...updates,
            alternatives: [
              { label: 'A', text: '', is_correct: false },
              { label: 'B', text: '', is_correct: false },
            ],
          };
        }
        if (updates.type === 'written') {
          return {
            ...item,
            ...updates,
            alternatives: undefined,
            criteria: item.criteria && item.criteria.length > 0
              ? item.criteria
              : [{ name: '', levels: [{ points: 3, description: '' }] }],
          };
        }
        return { ...item, ...updates };
      })
    );
  };

  // ─── Image upload helper for info section ─────────────
  const handleImageUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('La imagen no debe superar los 3 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateItem(id, { section_image_url: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  // ─── Alternative helpers ──────────────────────────────
  const addAlternative = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const alts = item.alternatives || [];
        if (alts.length >= 6) return item;
        const nextLabel = String.fromCharCode(65 + alts.length);
        return {
          ...item,
          alternatives: [...alts, { label: nextLabel, text: '', is_correct: false }],
        };
      })
    );
  };

  const removeAlternative = (itemId: string, altIndex: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const alts = (item.alternatives || []).filter((_, j) => j !== altIndex);
        return {
          ...item,
          alternatives: alts.map((a, j) => ({ ...a, label: String.fromCharCode(65 + j) })),
        };
      })
    );
  };

  const updateAlternativeText = (itemId: string, altIndex: number, text: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          alternatives: (item.alternatives || []).map((a, j) => (j === altIndex ? { ...a, text } : a)),
        };
      })
    );
  };

  const toggleCorrectAlternative = (itemId: string, altIndex: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          alternatives: (item.alternatives || []).map((a, j) => ({
            ...a,
            is_correct: j === altIndex,
          })),
        };
      })
    );
  };

  // ─── Criteria helpers ──────────────────────────────
  const addCriterion = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          criteria: [...(item.criteria || []), { name: '', levels: [{ points: 3, description: '' }] }],
        };
      })
    );
  };

  const removeCriterion = (itemId: string, cIndex: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return { ...item, criteria: (item.criteria || []).filter((_, ci) => ci !== cIndex) };
      })
    );
  };

  const updateCriterionName = (itemId: string, cIndex: number, name: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          criteria: (item.criteria || []).map((c, ci) => (ci === cIndex ? { ...c, name } : c)),
        };
      })
    );
  };

  const addCriterionLevel = (itemId: string, cIndex: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          criteria: (item.criteria || []).map((c, ci) => {
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

  const removeCriterionLevel = (itemId: string, cIndex: number, lIndex: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          criteria: (item.criteria || []).map((c, ci) => {
            if (ci !== cIndex) return c;
            return { ...c, levels: c.levels.filter((_, li) => li !== lIndex) };
          }),
        };
      })
    );
  };

  const updateCriterionLevel = (
    itemId: string,
    cIndex: number,
    lIndex: number,
    field: 'points' | 'description',
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          criteria: (item.criteria || []).map((c, ci) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) {
      alert('Selecciona una clase para la evaluación.');
      return;
    }

    if (items.length === 0) {
      alert('Agrega al menos una pregunta o sección a la evaluación.');
      return;
    }

    // Validations
    for (const item of items) {
      if (item.item_type === 'info_section') {
        if (!item.section_title?.trim()) {
          alert('Las secciones de información deben tener un título.');
          return;
        }
      } else if (item.item_type === 'divider') {
        if (!item.section_title?.trim()) {
          alert('Los divisores de sección deben tener un nombre/título.');
          return;
        }
      } else {
        if (item.type === 'multiple_choice') {
          const alts = item.alternatives || [];
          if (alts.length < 2) {
            alert(`Pregunta ${item.question_number}: debe tener al menos 2 alternativas.`);
            return;
          }
          const correctCount = alts.filter((a) => a.is_correct).length;
          if (correctCount === 0) {
            alert(`Pregunta ${item.question_number}: selecciona la alternativa correcta.`);
            return;
          }
        }

        if (item.type === 'written' && item.criteria && item.criteria.length > 0) {
          for (const criterion of item.criteria) {
            if (!criterion.name.trim()) {
              alert(`Pregunta ${item.question_number}: todos los criterios deben tener nombre.`);
              return;
            }
            if (criterion.levels.length === 0) {
              alert(
                `Pregunta ${item.question_number}: el criterio "${criterion.name}" debe tener al menos un nivel.`
              );
              return;
            }
            for (const level of criterion.levels) {
              if (level.points <= 0) {
                alert(
                  `Pregunta ${item.question_number}, criterio "${criterion.name}": cada nivel debe tener puntaje > 0.`
                );
                return;
              }
              if (!level.description.trim()) {
                alert(
                  `Pregunta ${item.question_number}, criterio "${criterion.name}": cada nivel debe tener descripción.`
                );
                return;
              }
            }
          }
        }
      }
    }

    try {
      const rubric = items.map((item) => {
        if (item.item_type === 'info_section') {
          return {
            item_type: 'info_section' as const,
            section_title: item.section_title,
            section_content: item.section_content,
            section_image_url: item.section_image_url,
          };
        } else if (item.item_type === 'divider') {
          return {
            item_type: 'divider' as const,
            section_title: item.section_title,
          };
        } else {
          const base: any = {
            item_type: 'question' as const,
            question_number: item.question_number,
            statement: item.statement,
            type: item.type,
            correct_answer: item.correct_answer || '',
            criteria: (item.criteria && item.criteria.length > 0) ? item.criteria : undefined,
            alternatives: item.type === 'multiple_choice' ? item.alternatives : undefined,
          };
          if (item.type === 'multiple_choice') {
            base.max_score = item.max_score || 1;
          }
          return base;
        }
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
              placeholder="Ej: Evaluación 1 — Comprensión lectora"
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
                  const val = e.target.value;
                  if (!val) {
                    setSelectedClass(null);
                    return;
                  }
                  const [course_id, subject] = val.split('|');
                  const found = myClasses?.find(
                    (c) => c.course_id === course_id && c.subject === subject
                  );
                  setSelectedClass(found || null);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                required
                aria-label="Clase"
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

        <Card title="Estructura de la Evaluación" subtitle="Agrega preguntas, secciones informativas o divisores de sección">
          <div className="space-y-4">
            {items.map((item, index) => (
              <div
                key={item.id}
                className={`p-4 rounded-lg border transition-all ${
                  item.item_type === 'divider'
                    ? 'bg-amber-50/80 border-amber-300 border-l-4 border-l-amber-500 shadow-sm'
                    : item.item_type === 'info_section'
                    ? 'bg-blue-50/70 border-blue-200 border-l-4 border-l-blue-400 shadow-sm'
                    : 'bg-emerald-50/60 border-emerald-200 border-l-4 border-l-emerald-500 shadow-sm'
                }`}
              >
                {/* Header de la tarjeta de item */}
                <div className="flex items-center justify-between mb-3 border-b pb-2">
                  <div className="flex items-center gap-2">
                    {item.item_type === 'divider' ? (
                      <span className="font-bold text-xs uppercase px-2.5 py-1 rounded bg-amber-500 text-white flex items-center gap-1 shadow-xs">
                        🏷️ DIVISOR DE SECCIÓN
                      </span>
                    ) : item.item_type === 'info_section' ? (
                      <span className="font-bold text-xs uppercase px-2.5 py-1 rounded bg-blue-600 text-white flex items-center gap-1 shadow-xs">
                        📄 INFORMACIÓN
                      </span>
                    ) : (
                      <span className="font-bold text-xs uppercase px-2.5 py-1 rounded bg-emerald-600 text-white flex items-center gap-1 shadow-xs">
                        <HelpCircle size={13} className="inline-block" />
                        <span>Pregunta {item.question_number}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveItem(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Mover arriba"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(index, 'down')}
                      disabled={index === items.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Mover abajo"
                    >
                      <ArrowDown size={16} />
                    </button>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors ml-2"
                        title="Eliminar elemento"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Render de Divisor de Sección */}
                {item.item_type === 'divider' ? (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-amber-900">
                      Nombre / Título de la Sección
                    </label>
                    <input
                      type="text"
                      value={item.section_title || ''}
                      onChange={(e) => updateItem(item.id, { section_title: e.target.value })}
                      placeholder="Ej: Sección I: Comprensión de Lectura"
                      className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>
                ) : item.item_type === 'info_section' ? (
                  /* Render de Sección Informativa */
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-blue-900 mb-1">
                        Título del Bloque Informativo (Opcional)
                      </label>
                      <input
                        type="text"
                        value={item.section_title || ''}
                        onChange={(e) => updateItem(item.id, { section_title: e.target.value })}
                        placeholder="Ej: Texto de Lectura N° 1 o Instrucciones Generales"
                        className="w-full rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-sm font-bold text-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-900 mb-1">
                        Texto / Descripción / Instrucciones
                      </label>
                      <textarea
                        value={item.section_content || ''}
                        onChange={(e) => updateItem(item.id, { section_content: e.target.value })}
                        placeholder="Escribe el texto de lectura, recomendaciones o instrucciones para los estudiantes..."
                        rows={3}
                        className="w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary resize-y"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-900 mb-1">
                        Imagen Adicional (Opcional)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(item.id, e)}
                          className="text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-brand-primary file:text-white hover:file:bg-brand-secondary cursor-pointer"
                        />
                        {item.section_image_url && (
                          <button
                            type="button"
                            onClick={() => updateItem(item.id, { section_image_url: '' })}
                            className="text-xs text-red-600 hover:underline font-medium"
                          >
                            Quitar imagen
                          </button>
                        )}
                      </div>
                      {item.section_image_url && (
                        <div className="mt-2 relative max-w-xs">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.section_image_url}
                            alt="Previsualización"
                            className="max-h-40 rounded border shadow-sm object-contain"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Render de Pregunta */
                  <div className="space-y-3">
                    <textarea
                      value={item.statement || ''}
                      onChange={(e) => updateItem(item.id, { statement: e.target.value })}
                      placeholder="Enunciado de la pregunta"
                      rows={2}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary resize-y"
                    />

                    <div className="flex gap-3 items-start flex-wrap">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                        <select
                          value={item.type}
                          onChange={(e) => updateItem(item.id, { type: e.target.value as any })}
                          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                          aria-label={`Tipo de pregunta ${item.question_number}`}
                        >
                          <option value="written">Desarrollo</option>
                          <option value="multiple_choice">Alternativas</option>
                        </select>
                      </div>

                      {item.type === 'multiple_choice' && (
                        <div className="w-40">
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Puntaje máx.
                          </label>
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            value={item.max_score || ''}
                            onChange={(e) =>
                              updateItem(item.id, { max_score: Number(e.target.value) })
                            }
                            placeholder="Pts"
                          />
                          <div className="flex flex-wrap gap-1 mt-1">
                            {[1, 2, 3, 4, 5, 10].map((pts) => (
                              <button
                                key={pts}
                                type="button"
                                onClick={() => updateItem(item.id, { max_score: pts })}
                                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                                  item.max_score === pts
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
                      {item.type === 'written' && (item.criteria || []).length > 0 && (
                        <div className="flex items-center gap-1 text-sm text-gray-500 self-center mt-4">
                          <span>
                            Total:{' '}
                            {(item.criteria || []).reduce(
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
                    </div>

                    {/* Alternativas */}
                    {item.type === 'multiple_choice' && (
                      <div className="space-y-2 pt-2 border-t">
                        <label className="text-xs font-semibold text-gray-700">Alternativas</label>
                        {(item.alternatives || []).map((alt, ai) => (
                          <div key={ai} className="flex items-center gap-2">
                            <span className="w-6 text-sm font-bold text-gray-500">{alt.label}</span>
                            <input
                              type="text"
                              value={alt.text}
                              onChange={(e) => updateAlternativeText(item.id, ai, e.target.value)}
                              placeholder={`Alternativa ${alt.label}`}
                              className="flex-1 rounded-lg border border-gray-300 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            />
                            <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={alt.is_correct}
                                onChange={() => toggleCorrectAlternative(item.id, ai)}
                                className="rounded"
                              />
                              Correcta
                            </label>
                            {(item.alternatives || []).length > 2 && (
                              <button
                                type="button"
                                onClick={() => removeAlternative(item.id, ai)}
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                aria-label={`Eliminar alternativa ${alt.label}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                        {(item.alternatives || []).length < 6 && (
                          <button
                            type="button"
                            onClick={() => addAlternative(item.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 transition-colors font-medium"
                          >
                            + Agregar alternativa
                          </button>
                        )}
                      </div>
                    )}

                    {/* Criterios para preguntas escritas */}
                    {item.type === 'written' && (
                      <div className="space-y-3 pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-gray-700">
                            Criterios de evaluación
                          </label>
                        </div>

                        {(item.criteria || []).map((criterion, cIdx) => (
                          <div
                            key={cIdx}
                            className="border border-gray-200 rounded-lg bg-white p-3"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-bold text-gray-400">
                                C{cIdx + 1}
                              </span>
                              <input
                                type="text"
                                value={criterion.name}
                                onChange={(e) =>
                                  updateCriterionName(item.id, cIdx, e.target.value)
                                }
                                placeholder="Nombre del criterio (ej: Ortografía)"
                                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-primary"
                              />
                              {(item.criteria || []).length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeCriterion(item.id, cIdx)}
                                  className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                                  aria-label={`Eliminar criterio ${cIdx + 1}`}
                                >
                                  ✕
                                </button>
                              )}
                            </div>

                            <div className="space-y-1.5 ml-5">
                              {criterion.levels.map((level, lIdx) => (
                                <div key={lIdx} className="flex items-start gap-2">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={level.points || ''}
                                      onChange={(e) =>
                                        updateCriterionLevel(
                                          item.id,
                                          cIdx,
                                          lIdx,
                                          'points',
                                          e.target.value
                                        )
                                      }
                                      placeholder="Pts"
                                      className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                    />
                                    <span className="text-xs text-gray-400 shrink-0">
                                      pts —
                                    </span>
                                    <input
                                      type="text"
                                      value={level.description}
                                      onChange={(e) =>
                                        updateCriterionLevel(
                                          item.id,
                                          cIdx,
                                          lIdx,
                                          'description',
                                          e.target.value
                                        )
                                      }
                                      placeholder="Descripción del nivel"
                                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                    />
                                  </div>
                                  {criterion.levels.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeCriterionLevel(item.id, cIdx, lIdx)
                                      }
                                      className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                                      aria-label={`Eliminar nivel ${lIdx + 1}`}
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              ))}

                              <button
                                type="button"
                                onClick={() => addCriterionLevel(item.id, cIdx)}
                                className="text-xs text-blue-600 hover:text-blue-800 transition-colors mt-1"
                              >
                                + Agregar nivel
                              </button>
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => addCriterion(item.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 transition-colors font-medium"
                        >
                          + Agregar criterio
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              brand="tiza"
              onClick={addQuestion}
              className="flex items-center gap-1 text-xs"
            >
              <Plus size={14} /> Agregar Pregunta
            </Button>
            <Button
              type="button"
              variant="outline"
              brand="tiza"
              onClick={addInfoSection}
              className="flex items-center gap-1 text-xs text-blue-700 border-blue-300 hover:bg-blue-50"
            >
              <FileText size={14} /> Agregar Sección de Información
            </Button>
            <Button
              type="button"
              variant="outline"
              brand="tiza"
              onClick={addDivider}
              className="flex items-center gap-1 text-xs text-amber-800 border-amber-400 bg-amber-50 hover:bg-amber-100"
            >
              <HelpCircle size={14} /> Agregar Divisor de Sección
            </Button>
          </div>
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
