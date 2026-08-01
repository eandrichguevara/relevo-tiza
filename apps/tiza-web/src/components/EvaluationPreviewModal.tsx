'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Printer, X, FileText, CheckCircle2, HelpCircle } from 'lucide-react';
import { Button } from '@tiza/ui';

export interface CriterionLevel {
  points: number;
  description: string;
}

export interface CriterionItem {
  name: string;
  levels: CriterionLevel[];
}

export interface AlternativeItem {
  label: string;
  text: string;
  is_correct: boolean;
}

export type ItemType = 'question' | 'info_section' | 'divider';

export interface PreviewEvaluationItem {
  id?: string;
  item_type?: ItemType;
  question_number?: number;
  statement?: string;
  type?: 'written' | 'multiple_choice';
  max_score?: number;
  correct_answer?: string;
  criteria?: CriterionItem[];
  alternatives?: AlternativeItem[];
  section_title?: string;
  section_content?: string;
  section_image_url?: string;
}

interface EvaluationPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subject?: string;
  grade?: string;
  items: PreviewEvaluationItem[];
}

export function EvaluationPreviewModal({
  isOpen,
  onClose,
  title,
  subject,
  grade,
  items,
}: EvaluationPreviewModalProps) {
  const [viewMode, setViewMode] = useState<'student' | 'teacher' | 'answer_sheet'>('student');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  // Calcular puntaje total de la prueba
  const totalScore = items.reduce((sum, item) => {
    if (item.item_type === 'info_section' || item.item_type === 'divider') return sum;
    if (item.type === 'multiple_choice') {
      return sum + (item.max_score || 1);
    }
    if (item.type === 'written' && item.criteria && item.criteria.length > 0) {
      const qScore = item.criteria.reduce((cSum, c) => {
        const maxLevelPts = c.levels && c.levels.length > 0 ? Math.max(...c.levels.map((l) => l.points || 0)) : 0;
        return cSum + maxLevelPts;
      }, 0);
      return sum + qScore;
    }
    return sum;
  }, 0);

  const handlePrint = () => {
    window.print();
  };

  // Filtrar solo las preguntas (excluir info_section y divider para la hoja de respuestas)
  const questionItems = items.filter((item) => item.item_type === 'question' || !item.item_type);

  return createPortal(
    <div
      id="preview-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto print:static print:inset-auto print:z-auto print:bg-white print:p-0 print:overflow-visible print:block"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
    >
      <style>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          body > *:not(#preview-modal-overlay) {
            display: none !important;
          }
          #preview-modal-overlay {
            display: block !important;
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            z-index: 99999 !important;
          }
          #preview-modal-card {
            border: none !important;
            box-shadow: none !important;
            max-width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
      <div
        id="preview-modal-card"
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden my-auto border border-gray-200 print:shadow-none print:border-none print:rounded-none print:max-w-none print:max-h-none print:h-auto print:w-full print:my-0 print:overflow-visible"
      >
        {/* Barra superior de control (no se imprime) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary">
              <Eye size={20} />
            </div>
            <div>
              <h2 id="preview-title" className="text-lg font-bold text-gray-900 leading-tight">
                Vista previa de evaluación
              </h2>
              <p className="text-xs text-gray-500">
                Previsualiza y formatea los documentos de evaluación para imprimir
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Conmutador de 3 Vistas */}
            <div className="flex items-center bg-gray-200 p-1 rounded-lg text-xs font-semibold gap-1">
              <button
                type="button"
                onClick={() => setViewMode('student')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  viewMode === 'student'
                    ? 'bg-white text-brand-primary shadow-xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Vista Estudiante
              </button>
              <button
                type="button"
                onClick={() => setViewMode('teacher')}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1 ${
                  viewMode === 'teacher'
                    ? 'bg-purple-700 text-white shadow-xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <CheckCircle2 size={13} />
                Pauta Profesor
              </button>
              <button
                type="button"
                onClick={() => setViewMode('answer_sheet')}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1 ${
                  viewMode === 'answer_sheet'
                    ? 'bg-amber-600 text-white shadow-xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText size={13} />
                Hoja de Respuestas
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              brand="tiza"
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-xs py-1.5 px-3"
            >
              <Printer size={15} /> Imprimir / PDF
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200 transition-colors ml-1"
              aria-label="Cerrar previsualización"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Contenido según el documento seleccionado */}
        <div className="p-8 overflow-y-auto flex-1 bg-white print:p-[15mm] print:overflow-visible print:block text-gray-900 font-sans">
          {viewMode === 'answer_sheet' ? (
            /* ─────────────────────────────────────────────────────────────
               DOCUMENTO 3: HOJA DE RESPUESTAS (Optimizada para IA)
               ───────────────────────────────────────────────────────────── */
            <div>
              {/* Encabezado minimalista de la Hoja de Respuestas */}
              <div className="border-2 border-gray-800 p-4 rounded-lg mb-6 space-y-3 print:break-inside-avoid">
                <div className="flex justify-between items-center border-b border-gray-300 pb-2">
                  <div>
                    <h1 className="text-lg font-extrabold uppercase tracking-wide text-gray-900">
                      HOJA DE RESPUESTAS
                    </h1>
                    <p className="text-xs font-medium text-gray-600">
                      {title || 'EVALUACIÓN'} — {subject || 'Asignatura'} ({grade || 'Nivel'})
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="border-b border-gray-400 pb-1">
                    <span className="font-semibold text-gray-600">Nombre del Estudiante:</span>
                  </div>
                  <div className="border-b border-gray-400 pb-1">
                    <span className="font-semibold text-gray-600">Fecha:</span>
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-200 p-2.5 rounded text-xs text-gray-700">
                  <span className="font-bold text-gray-900">Instrucciones generales: </span>
                  Para preguntas de selección múltiple, rellene la burbuja de la opción elegida. Para preguntas de desarrollo, escriba su respuesta respetando los límites del recuadro.
                </div>
              </div>

              {/* Grid de 2 columnas por fila para la Hoja de Respuestas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2">
                {questionItems.length === 0 ? (
                  <p className="text-center text-gray-400 py-12 text-sm italic col-span-full">
                    No hay preguntas para responder en esta evaluación.
                  </p>
                ) : (
                  questionItems.map((item, qIdx) => {
                    const qNum = item.question_number || qIdx + 1;
                    const isMultipleChoice = item.type === 'multiple_choice';

                    return (
                      <div
                        key={item.id || qIdx}
                        className="aspect-square w-full border-2 border-gray-800 rounded-lg p-4 bg-white flex flex-col justify-between print:break-inside-avoid shadow-xs relative overflow-hidden"
                        data-testid={`answer-block-${qNum}`}
                      >
                        {/* Indicadores de esquina para alineación de escáner OCR / IA */}
                        <div className="absolute top-1 left-1 w-2 h-2 bg-gray-800" />
                        <div className="absolute top-1 right-1 w-2 h-2 bg-gray-800" />
                        <div className="absolute bottom-1 left-1 w-2 h-2 bg-gray-800" />
                        <div className="absolute bottom-1 right-1 w-2 h-2 bg-gray-800" />

                        {/* Encabezado de la caja de respuesta */}
                        <div className="border-b border-gray-300 pb-2 flex justify-between items-center">
                          <span className="font-extrabold text-base text-gray-900">
                            Pregunta {qNum}
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 border border-gray-300 text-gray-700">
                            {isMultipleChoice ? 'Selección Múltiple' : 'Desarrollo'}
                          </span>
                        </div>

                        {/* Contenido limpio de la caja de respuesta */}
                        <div className="flex-1 py-3 flex flex-col justify-center">
                          {isMultipleChoice ? (
                            <div className="grid grid-cols-1 gap-2.5 max-w-[240px] mx-auto w-full">
                              {(item.alternatives && item.alternatives.length > 0
                                ? item.alternatives
                                : [
                                    { label: 'A' },
                                    { label: 'B' },
                                    { label: 'C' },
                                    { label: 'D' },
                                  ]
                              ).map((alt, aIdx) => (
                                <div
                                  key={aIdx}
                                  className="flex items-center gap-3 p-1.5 border border-gray-300 rounded-md bg-gray-50/50"
                                >
                                  <div className="w-7 h-7 rounded-full border-2 border-gray-700 flex items-center justify-center font-bold text-xs bg-white text-gray-900">
                                    {alt.label}
                                  </div>
                                  <div className="flex-1 border-b border-dashed border-gray-300 h-4"></div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="h-full flex flex-col justify-between pt-1">
                              <div className="flex-1 border border-gray-300 rounded-md p-2 bg-gray-50/30 flex flex-col justify-around">
                                <div className="border-b border-dashed border-gray-300 h-6"></div>
                                <div className="border-b border-dashed border-gray-300 h-6"></div>
                                <div className="border-b border-dashed border-gray-300 h-6"></div>
                                <div className="border-b border-dashed border-gray-300 h-6"></div>
                                <div className="border-b border-dashed border-gray-300 h-6"></div>
                                <div className="border-b border-dashed border-gray-300 h-6"></div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Pie minimalista */}
                        <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-[10px] text-gray-400 font-mono">
                          <span>BLOQUE #P{qNum}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* ─────────────────────────────────────────────────────────────
               DOCUMENTO 1 & 2: VISTA ESTUDIANTE Y PAUTA PROFESOR
               ───────────────────────────────────────────────────────────── */
            <div>
              {/* Encabezado Oficial de Prueba */}
              <div className="border-2 border-gray-800 p-5 rounded-lg mb-6 space-y-4 print:break-inside-avoid">
                <div className="flex justify-between items-start border-b border-gray-300 pb-3">
                  <div>
                    <h1 className="text-xl font-bold uppercase tracking-wide text-gray-900">
                      {title || 'EVALUACIÓN DE APRENDIZAJE'}
                    </h1>
                    <p className="text-sm font-medium text-gray-700 mt-0.5">
                      {subject || 'Asignatura'} — {grade || 'Nivel'}
                    </p>
                  </div>
                  <div className="text-right border border-gray-400 rounded-md px-3 py-2 bg-gray-50/50 min-w-[140px]">
                    <div className="text-[11px] font-bold text-gray-600 uppercase">Puntaje Ideal</div>
                    <div className="text-lg font-extrabold text-brand-secondary">{totalScore} pts</div>
                  </div>
                </div>

                {/* Datos del estudiante (campos para completar) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="border-b border-gray-400 pb-1">
                    <span className="font-semibold text-gray-600">Nombre del Estudiante:</span>
                  </div>
                  <div className="border-b border-gray-400 pb-1">
                    <span className="font-semibold text-gray-600">Fecha:</span>
                  </div>
                  <div className="flex justify-between items-center bg-gray-50 border border-gray-300 px-3 py-1 rounded">
                    <span className="font-semibold text-gray-600">Puntaje Obtenido:</span>
                    <span className="font-semibold text-gray-600">Nota:</span>
                  </div>
                </div>
              </div>

              {/* Banner indicador de Pauta de Profesor */}
              {viewMode === 'teacher' && (
                <div className="mb-6 p-3 bg-purple-50 border border-purple-200 text-purple-900 rounded-lg text-xs flex items-center gap-2 font-medium print:hidden">
                  <CheckCircle2 size={16} className="text-purple-700 shrink-0" />
                  <span>
                    <strong>Modo Pauta de Corrección:</strong> Se muestran marcadas las alternativas correctas en verde y las rúbricas detalladas para preguntas de desarrollo.
                  </span>
                </div>
              )}

              {/* Items de la prueba */}
              <div className="space-y-6">
                {items.length === 0 ? (
                  <p className="text-center text-gray-400 py-12 text-sm italic">
                    No hay elementos en esta evaluación aún.
                  </p>
                ) : (
                  items.map((item, index) => {
                    const itemType = item.item_type || 'question';

                    // Render: Divisor de Sección
                    if (itemType === 'divider') {
                      return (
                        <div
                          key={item.id || index}
                          className="border-b-2 border-gray-900 pt-4 pb-1 mt-6 first:mt-0 print:break-inside-avoid"
                        >
                          <h2 className="text-base font-extrabold tracking-wide uppercase text-gray-900">
                            {item.section_title || 'SECCIÓN'}
                          </h2>
                        </div>
                      );
                    }

                    // Render: Sección Informativa
                    if (itemType === 'info_section') {
                      return (
                        <div
                          key={item.id || index}
                          className="bg-gray-50/50 border-l-4 border-gray-800 p-4 rounded-r-lg space-y-2 text-sm my-4 print:break-inside-avoid"
                        >
                          {item.section_title && (
                            <h3 className="font-bold text-gray-900 text-sm">{item.section_title}</h3>
                          )}
                          {item.section_content && (
                            <p className="text-gray-800 whitespace-pre-wrap leading-relaxed text-xs sm:text-sm">
                              {item.section_content}
                            </p>
                          )}
                          {item.section_image_url && (
                            <div className="pt-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.section_image_url}
                                alt="Recurso informativo"
                                className="max-h-60 rounded border border-gray-200 object-contain mx-auto"
                              />
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Render: Pregunta (multiple_choice o written)
                    return (
                      <div key={item.id || index} className="space-y-3 pt-2 print:break-inside-avoid">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2">
                            <span className="font-extrabold text-sm text-gray-900 shrink-0">
                              {item.question_number || index + 1}.
                            </span>
                            <div className="text-sm text-gray-900 font-medium leading-normal whitespace-pre-wrap">
                              {item.statement || <span className="text-gray-400 italic">[Enunciado pendiente]</span>}
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-gray-500 whitespace-nowrap bg-gray-100 px-2 py-0.5 rounded shrink-0">
                            {item.type === 'multiple_choice'
                              ? `${item.max_score || 1} pt${(item.max_score || 1) > 1 ? 's' : ''}`
                              : `${(item.criteria || []).reduce(
                                  (sum, c) =>
                                    sum +
                                    (c.levels && c.levels.length > 0
                                      ? Math.max(...c.levels.map((l) => l.points || 0))
                                      : 0),
                                  0
                                )} pts`}
                          </span>
                        </div>

                        {/* Pregunta de Alternativas */}
                        {item.type === 'multiple_choice' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6 pt-1">
                            {(item.alternatives || []).map((alt, aIdx) => {
                              const isCorrect = alt.is_correct;
                              const showCorrectHighlight = viewMode === 'teacher' && isCorrect;

                              return (
                                <div
                                  key={aIdx}
                                  className={`flex items-start gap-2.5 p-2 rounded border text-xs transition-colors ${
                                    showCorrectHighlight
                                      ? 'bg-emerald-50 border-emerald-400 font-semibold text-emerald-950'
                                      : 'border-gray-200 bg-white text-gray-800'
                                  }`}
                                >
                                  <span
                                    className={`w-5 h-5 rounded-full border flex items-center justify-center font-bold text-[11px] shrink-0 ${
                                      showCorrectHighlight
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'border-gray-400 text-gray-700 bg-gray-50'
                                    }`}
                                  >
                                    {alt.label}
                                  </span>
                                  <span className="pt-0.5 flex-1">{alt.text || <span className="text-gray-400 italic">Opción sin texto</span>}</span>
                                  {showCorrectHighlight && (
                                    <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded ml-auto">
                                      Correcta
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Pregunta Escrita / Desarrollo */}
                        {item.type === 'written' && (
                          <div className="pl-6 space-y-3">
                            {/* En Vista Profesor: Muestra rúbrica detallada */}
                            {viewMode === 'teacher' && (
                              <div className="border border-purple-200 rounded-lg bg-purple-50/40 p-3 space-y-2 text-xs">
                                <div className="font-bold text-purple-900 flex items-center gap-1">
                                  <HelpCircle size={14} className="text-purple-700" />
                                  <span>Rúbrica de corrección:</span>
                                </div>
                                {(item.criteria || []).length === 0 ? (
                                  <p className="text-gray-500 italic">Sin criterios asignados.</p>
                                ) : (
                                  (item.criteria || []).map((crit, cIdx) => (
                                    <div key={cIdx} className="bg-white border border-purple-100 rounded p-2.5 space-y-1.5">
                                      <div className="font-bold text-gray-900">
                                        Criterio {cIdx + 1}: {crit.name || 'Sin nombre'}
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        {crit.levels.map((lvl, lIdx) => (
                                          <div
                                            key={lIdx}
                                            className="p-1.5 rounded bg-gray-50 border border-gray-200 text-[11px]"
                                          >
                                            <span className="font-bold text-purple-800">{lvl.points} pts: </span>
                                            <span className="text-gray-700">{lvl.description || 'Sin descripción'}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
