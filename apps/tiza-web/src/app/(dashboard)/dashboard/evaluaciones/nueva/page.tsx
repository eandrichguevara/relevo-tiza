'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Input, Button, Spinner } from '@tiza/ui';
import { Plus, Trash2, FileText, Image as ImageIcon, HelpCircle, ArrowUp, ArrowDown, Sparkles, Wand2, Eye, Undo2, Redo2 } from 'lucide-react';
import { EvaluationPreviewModal } from '@/components/EvaluationPreviewModal';
import {
  useCreateEvaluation,
  useMyClasses,
  useSuggestDistractors,
  useRefineQuestion,
  useSuggestRubric,
  type TeacherClass,
} from '@/hooks/useApi';
import { useAutosave } from '@/hooks/useAutosave';

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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const suggestDistractors = useSuggestDistractors();
  const refineQuestion = useRefineQuestion();
  const suggestRubric = useSuggestRubric();
  const [loadingAiKey, setLoadingAiKey] = useState<string | null>(null);
  // Sugerencia IA pendiente de aceptar por cada campo del formulario
  const [aiSuggestion, setAiSuggestion] = useState<{ key: string; statement: string } | null>(null);
  // ─── Historial para Deshacer/Rehacer (Ctrl+Z / Ctrl+Y) ───────────────
  const historyStack = useRef<{ title: string; items: EvaluationItem[] }[]>([]);
  const historyIndex = useRef<number>(-1);
  const isUndoingRedoing = useRef<boolean>(false);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateCanUndoRedo = useCallback(() => {
    setCanUndo(historyIndex.current > 0);
    setCanRedo(historyIndex.current < historyStack.current.length - 1);
  }, []);

  const pushHistory = useCallback((newTitle: string, newItems: EvaluationItem[], forceImmediate = false) => {
    if (isUndoingRedoing.current) return;

    const doPush = () => {
      const currentStack = historyStack.current.slice(0, historyIndex.current + 1);
      const lastState = currentStack[currentStack.length - 1];

      if (lastState && lastState.title === newTitle && JSON.stringify(lastState.items) === JSON.stringify(newItems)) {
        return;
      }

      const nextStack = [...currentStack, { title: newTitle, items: JSON.parse(JSON.stringify(newItems)) }];
      if (nextStack.length > 50) nextStack.shift();

      historyStack.current = nextStack;
      historyIndex.current = nextStack.length - 1;
      updateCanUndoRedo();
    };

    if (forceImmediate) {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      doPush();
    } else {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = setTimeout(doPush, 400);
    }
  }, [updateCanUndoRedo]);

  const handleUndo = useCallback(() => {
    if (historyIndex.current > 0) {
      isUndoingRedoing.current = true;
      historyIndex.current -= 1;
      const snapshot = historyStack.current[historyIndex.current];
      setTitle(snapshot.title);
      setItems(JSON.parse(JSON.stringify(snapshot.items)));
      setAiSuggestion(null);
      updateCanUndoRedo();
      setTimeout(() => {
        isUndoingRedoing.current = false;
      }, 50);
    }
  }, [updateCanUndoRedo]);

  const handleRedo = useCallback(() => {
    if (historyIndex.current < historyStack.current.length - 1) {
      isUndoingRedoing.current = true;
      historyIndex.current += 1;
      const snapshot = historyStack.current[historyIndex.current];
      setTitle(snapshot.title);
      setItems(JSON.parse(JSON.stringify(snapshot.items)));
      setAiSuggestion(null);
      updateCanUndoRedo();
      setTimeout(() => {
        isUndoingRedoing.current = false;
      }, 50);
    }
  }, [updateCanUndoRedo]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      if (ctrlKey && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if (ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleUndo, handleRedo]);

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Contexto de la sección acotada (entre el divisor anterior y el divisor siguiente)
  const getSectionContext = (itemIndex: number) => {
    let startIdx = 0;
    for (let i = itemIndex - 1; i >= 0; i--) {
      if (items[i].item_type === 'divider' || items[i].item_type === 'info_section') {
        startIdx = i;
        break;
      }
    }

    let endIdx = items.length;
    for (let i = itemIndex + 1; i < items.length; i++) {
      if (items[i].item_type === 'divider' || items[i].item_type === 'info_section') {
        endIdx = i;
        break;
      }
    }

    const sectionItems = items.slice(startIdx, endIdx);
    const parts: string[] = [];

    sectionItems.forEach((it, idx) => {
      const realIndex = startIdx + idx;
      if (it.item_type === 'divider' || it.item_type === 'info_section') {
        const title = it.section_title || it.section_content;
        if (title) parts.push(`Encabezado: ${title}`);
      } else if (it.item_type === 'question' && realIndex !== itemIndex && it.statement) {
        parts.push(`P${it.question_number}: ${it.statement}`);
      }
    });

    return parts.join(' | ');
  };

  // Disparador genérico de autocompletado Copilot para cualquier campo
  const triggerAutocomplete = (
    key: string,
    val: string,
    fieldType: string,
    opts?: {
      itemIndex?: number;
      questionStatement?: string;
      criterionName?: string;
      questionType?: string;
      existingAlternatives?: string[];
      criteria?: any[];
      currentLevelPoints?: number;
    }
  ) => {
    if (aiSuggestion?.key === key) setAiSuggestion(null);
    clearTimeout(debounceTimers.current[key]);

    if (val.trim().length >= 5) {
      debounceTimers.current[key] = setTimeout(async () => {
        setLoadingAiKey(key);
        try {
          const secContext = opts?.itemIndex !== undefined ? getSectionContext(opts.itemIndex) : undefined;
          const res = await refineQuestion.mutateAsync({
            statement: val,
            action: 'autocomplete',
            field_type: fieldType,
            evaluation_title: title,
            subject: selectedClass?.subject,
            grade: selectedClass?.grade,
            section_context: secContext,
            question_statement: opts?.questionStatement,
            criterion_name: opts?.criterionName,
            question_type: opts?.questionType,
            existing_alternatives: opts?.existingAlternatives,
            criteria: opts?.criteria,
            current_level_points: opts?.currentLevelPoints,
          });
          if (res.refined_statement && res.refined_statement.trim() !== val.trim()) {
            setAiSuggestion({ key, statement: res.refined_statement });
          }
        } catch (err: any) {
          console.error('[AI autocomplete] error:', err?.translatedMessage || err?.detail || err?.message || err);
        } finally {
          setLoadingAiKey(null);
        }
      }, 300);
    }
  };

  const autoResizeTextarea = (el: HTMLTextAreaElement | null, suggestionText?: string) => {
    if (!el) return;
    el.style.height = 'auto';
    const currentVal = el.value || '';
    if (suggestionText && suggestionText.length > currentVal.length) {
      el.value = suggestionText;
      const sugH = el.scrollHeight;
      el.value = currentVal;
      el.style.height = `${Math.max(38, sugH)}px`;
    } else {
      el.style.height = `${Math.max(38, el.scrollHeight)}px`;
    }
  };

  const handleAutocompleteKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, key: string, onAccept: (newVal: string) => void) => {
    if (e.key === 'Tab' && aiSuggestion?.key === key) {
      e.preventDefault();
      // Guardar el estado actual en el historial antes de aplicar el autocompletado
      pushHistory(title, items, true);
      const cleanAccepted = aiSuggestion.statement.replace(/ {2,}/g, ' ');
      onAccept(cleanAccepted);
      clearTimeout(debounceTimers.current[key]);
      setAiSuggestion(null);

      const target = e.currentTarget;
      if (target && target.tagName === 'TEXTAREA') {
        setTimeout(() => {
          autoResizeTextarea(target as HTMLTextAreaElement);
        }, 0);
      }
    }
    if (e.key === 'Escape' && aiSuggestion?.key === key) {
      setAiSuggestion(null);
    }
  };

  const getPlaceholder = (key: string, defaultPlaceholder: string) => {
    return aiSuggestion?.key === key ? '' : defaultPlaceholder;
  };

  // Renderizador del texto fantasma alineado estilo Copilot
  const renderGhostOverlay = (key: string, currentValue: string, paddingClass = "px-3 py-1.5") => {
    if (aiSuggestion?.key !== key || !aiSuggestion.statement) return null;
    const currentVal = currentValue || '';
    const sug = aiSuggestion.statement;

    let content = null;
    if (sug.toLowerCase().startsWith(currentVal.toLowerCase())) {
      content = (
        <>
          <span className="opacity-0">{currentVal}</span>
          <span className="text-gray-400 select-none font-normal">{sug.slice(currentVal.length)}</span>
        </>
      );
    } else {
      content = (
        <>
          <span className="opacity-0">{currentVal}</span>
          <span className="text-purple-400/80 select-none font-normal"> — {sug}</span>
        </>
      );
    }

    return (
      <div
        className={`absolute inset-0 pointer-events-none text-sm leading-normal font-sans whitespace-pre-wrap break-words overflow-hidden z-0 ${paddingClass}`}
        aria-hidden="true"
      >
        {content}
      </div>
    );
  };

  const renderCopilotBadge = (key: string) => {
    if (aiSuggestion?.key !== key) return null;
    return (
      <div className="absolute right-2 bottom-1.5 z-20 flex items-center gap-1 text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 shadow-xs pointer-events-none animate-in fade-in duration-150">
        <Sparkles size={10} className="text-purple-600" />
        <span><kbd className="px-1 bg-white rounded border border-purple-300 font-mono font-bold text-purple-800">Tab</kbd></span>
      </div>
    );
  };



  const handleSuggestDistractors = async (item: EvaluationItem) => {
    if (!item.statement?.trim()) {
      alert('Escribe el enunciado de la pregunta antes de generar alternativas.');
      return;
    }
    const correctAlt = (item.alternatives || []).find((a) => a.is_correct) || item.alternatives?.[0];
    const correctText = correctAlt?.text || 'Opción correcta';

    setLoadingAiKey(`${item.id}-distractors`);
    try {
      const res = await suggestDistractors.mutateAsync({
        statement: item.statement,
        correct_answer: correctText,
        count: 3,
      });

      if (res.distractors && res.distractors.length > 0) {
        const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
        const existingAlts = item.alternatives || [];
        const newAlts: AlternativeItem[] = [...existingAlts];

        res.distractors.forEach((dText) => {
          if (newAlts.length < 6) {
            const nextLabel = labels[newAlts.length] || `Option ${newAlts.length + 1}`;
            newAlts.push({ label: nextLabel, text: dText, is_correct: false });
          }
        });

        updateItem(item.id, { alternatives: newAlts });
      }
    } catch (err: any) {
      const msg = err?.detail || err?.translatedMessage || err?.message || 'Error desconocido';
      alert('Error al generar alternativas con IA: ' + msg);
    } finally {
      setLoadingAiKey(null);
    }
  };

  const handleRefineQuestion = async (item: EvaluationItem, action: 'improve' | 'simplify' | 'harder') => {
    if (!item.statement?.trim()) {
      alert('Escribe el enunciado de la pregunta antes de refinar.');
      return;
    }

    setLoadingAiKey(`${item.id}-${action}`);
    try {
      const res = await refineQuestion.mutateAsync({
        statement: item.statement,
        action,
        criteria: item.criteria as any,
      });
      if (res.refined_statement) {
        updateItem(item.id, {
          statement: res.refined_statement,
          ...(res.criteria ? { criteria: res.criteria } : {}),
        });
      }
    } catch (err: any) {
      const msg = err?.detail || err?.translatedMessage || err?.message || 'Error desconocido';
      alert('Error al refinar pregunta con IA: ' + msg);
    } finally {
      setLoadingAiKey(null);
    }
  };

  const handleSuggestRubric = async (item: EvaluationItem) => {
    if (!item.statement?.trim()) {
      alert('Escribe el enunciado de la pregunta antes de generar la rúbrica.');
      return;
    }

    setLoadingAiKey(`${item.id}-rubric`);
    try {
      const res = await suggestRubric.mutateAsync({
        statement: item.statement,
        max_score: 3.0,
      });
      if (res.criteria && res.criteria.length > 0) {
        updateItem(item.id, { criteria: res.criteria });
      }
    } catch (err: any) {
      const msg = err?.detail || err?.translatedMessage || err?.message || 'Error desconocido';
      alert('Error al generar rúbrica con IA: ' + msg);
    } finally {
      setLoadingAiKey(null);
    }
  };

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
    { ...createDefaultInfoSection('item-1'), section_title: 'Instrucciones' },
    { ...createDefaultDivider('item-2'), section_title: 'Sección I' },
    createDefaultWrittenQuestion('item-3', 1),
  ]);

  // ─── Autoguardado (localStorage) ──────────────────────────────────────
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<{
    title?: string;
    selectedClass?: TeacherClass | null;
    items?: EvaluationItem[];
  } | null>(null);

  const autosave = useAutosave({
    key: 'tiza:draft:nueva-eval',
    data: { title, selectedClass, items },
    debounceMs: 2000,
  });

  // Check draft on mount
  useEffect(() => {
    if (autosave.hasDraft) {
      const draft = autosave.loadDraft();
      if (draft && (draft.title || (draft.items && draft.items.length > 0))) {
        setPendingDraft(draft);
        setShowDraftBanner(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyDraft = () => {
    if (pendingDraft) {
      if (pendingDraft.title !== undefined) setTitle(pendingDraft.title);
      if (pendingDraft.selectedClass !== undefined) setSelectedClass(pendingDraft.selectedClass);
      if (pendingDraft.items && pendingDraft.items.length > 0) setItems(pendingDraft.items);
    }
    setShowDraftBanner(false);
  };

  const handleDiscardDraft = () => {
    autosave.clearDraft();
    setShowDraftBanner(false);
    setPendingDraft(null);
  };

  // Warn user before leaving page if there are edits
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (title.trim() || items.some((it) => it.statement?.trim() || it.section_title?.trim())) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [title, items]);

  useEffect(() => {
    if (historyStack.current.length === 0 && items.length > 0) {
      historyStack.current = [{ title, items: JSON.parse(JSON.stringify(items)) }];
      historyIndex.current = 0;
      updateCanUndoRedo();
    } else {
      pushHistory(title, items, false);
    }
  }, [title, items, pushHistory, updateCanUndoRedo]);

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
      autosave.clearDraft();
      router.push('/dashboard/evaluaciones');
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div>
      {/* Banner de restauración de borrador */}
      {showDraftBanner && (
        <div className="mb-6 p-4 rounded-xl bg-purple-50 border border-purple-200 flex flex-wrap items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="text-xl">📝</span>
            <div>
              <p className="text-sm font-semibold text-purple-950">
                Se encontró un borrador guardado automáticamente
              </p>
              <p className="text-xs text-purple-700">
                {autosave.lastSavedAt
                  ? `Guardado el ${autosave.lastSavedAt.toLocaleDateString()} a las ${autosave.lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : '¿Deseas restaurar tu trabajo previo?'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              brand="tiza"
              onClick={handleDiscardDraft}
              className="text-xs text-purple-700 border-purple-300 hover:bg-purple-100"
            >
              Descartar borrador
            </Button>
            <Button
              type="button"
              brand="tiza"
              onClick={handleApplyDraft}
              className="text-xs"
            >
              Restaurar borrador
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-brand-secondary">Nueva evaluación</h1>
          {autosave.savingStatus === 'saving' && (
            <span className="text-xs text-gray-400 font-medium animate-pulse flex items-center gap-1">
              💾 Guardando borrador...
            </span>
          )}
          {autosave.savingStatus === 'saved' && (
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              ✓ Borrador guardado
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            brand="tiza"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Deshacer (Ctrl+Z)"
            className="flex items-center gap-1 text-xs font-semibold"
          >
            <Undo2 size={15} /> Deshacer
          </Button>
          <Button
            type="button"
            variant="outline"
            brand="tiza"
            onClick={handleRedo}
            disabled={!canRedo}
            title="Rehacer (Ctrl+Y)"
            className="flex items-center gap-1 text-xs font-semibold"
          >
            <Redo2 size={15} /> Rehacer
          </Button>
          <Button
            type="button"
            variant="outline"
            brand="tiza"
            onClick={() => setIsPreviewOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <Eye size={15} /> Previsualizar
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label htmlFor="eval-title" className="block text-sm font-medium text-gray-700 mb-1">Título de la evaluación</label>
              <div className="relative">
                {renderGhostOverlay('eval-title', title, "px-3 py-2")}
                <textarea
                  id="eval-title"
                  ref={(el) => autoResizeTextarea(el, aiSuggestion?.key === 'eval-title' ? aiSuggestion.statement : undefined)}
                  value={title}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTitle(val);
                    triggerAutocomplete('eval-title', val, 'evaluation_title');
                    autoResizeTextarea(e.target, aiSuggestion?.key === 'eval-title' ? aiSuggestion.statement : undefined);
                  }}
                  onKeyDown={(e) => handleAutocompleteKeyDown(e, 'eval-title', (newVal) => setTitle(newVal))}
                  placeholder={getPlaceholder('eval-title', 'Ej: Evaluación 1 — Comprensión lectora')}
                  required
                  rows={1}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-transparent relative z-10 focus:outline-none focus:ring-2 focus:ring-brand-primary overflow-hidden resize-none"
                />
                {renderCopilotBadge('eval-title')}
              </div>
            </div>
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
                className={`relative p-4 rounded-lg border transition-all ${
                  item.item_type === 'divider'
                    ? 'bg-amber-50/80 border-amber-300 border-l-4 border-l-amber-500 shadow-sm'
                    : item.item_type === 'info_section'
                    ? 'bg-blue-50/70 border-blue-200 border-l-4 border-l-blue-400 shadow-sm'
                    : 'bg-emerald-50/60 border-emerald-200 border-l-4 border-l-emerald-500 shadow-sm'
                } `}
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
                    <div className="relative">
                      {renderGhostOverlay(`${item.id}-divider_title`, item.section_title || '', "px-3 py-1.5")}
                      <textarea
                        ref={(el) => autoResizeTextarea(el, aiSuggestion?.key === `${item.id}-divider_title` ? aiSuggestion.statement : undefined)}
                        value={item.section_title || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateItem(item.id, { section_title: val });
                          triggerAutocomplete(`${item.id}-divider_title`, val, 'divider_title', { itemIndex: index });
                          autoResizeTextarea(e.target, aiSuggestion?.key === `${item.id}-divider_title` ? aiSuggestion.statement : undefined);
                        }}
                        onKeyDown={(e) => handleAutocompleteKeyDown(e, `${item.id}-divider_title`, (newVal) => updateItem(item.id, { section_title: newVal }))}
                        placeholder={getPlaceholder(`${item.id}-divider_title`, 'Ej: Sección I: Comprensión de Lectura')}
                        rows={1}
                        className="w-full rounded-lg border border-amber-300 bg-transparent relative z-10 px-3 py-1.5 text-sm font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 overflow-hidden resize-none"
                        required
                      />
                      {renderCopilotBadge(`${item.id}-divider_title`)}
                    </div>
                  </div>
                ) : item.item_type === 'info_section' ? (
                  /* Render de Sección Informativa */
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-blue-900 mb-1">
                        Título del Bloque Informativo (Opcional)
                      </label>
                      <div className="relative">
                        {renderGhostOverlay(`${item.id}-info_title`, item.section_title || '', "px-3 py-1.5")}
                        <textarea
                          ref={(el) => autoResizeTextarea(el, aiSuggestion?.key === `${item.id}-info_title` ? aiSuggestion.statement : undefined)}
                          value={item.section_title || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateItem(item.id, { section_title: val });
                            triggerAutocomplete(`${item.id}-info_title`, val, 'info_title', { itemIndex: index });
                            autoResizeTextarea(e.target, aiSuggestion?.key === `${item.id}-info_title` ? aiSuggestion.statement : undefined);
                          }}
                          onKeyDown={(e) => handleAutocompleteKeyDown(e, `${item.id}-info_title`, (newVal) => updateItem(item.id, { section_title: newVal }))}
                          placeholder={getPlaceholder(`${item.id}-info_title`, 'Ej: Texto de Lectura N° 1 o Instrucciones Generales')}
                          rows={1}
                          className="w-full rounded-lg border border-blue-300 bg-transparent relative z-10 px-3 py-1.5 text-sm font-bold text-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary overflow-hidden resize-none"
                        />
                        {renderCopilotBadge(`${item.id}-info_title`)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-900 mb-1">
                        Texto / Descripción / Instrucciones
                      </label>
                      <div className="relative">
                        {renderGhostOverlay(`${item.id}-info_content`, item.section_content || '', "px-3 py-1.5")}
                        <textarea
                          ref={(el) => autoResizeTextarea(el, aiSuggestion?.key === `${item.id}-info_content` ? aiSuggestion.statement : undefined)}
                          value={item.section_content || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateItem(item.id, { section_content: val });
                            triggerAutocomplete(`${item.id}-info_content`, val, 'info_content', { itemIndex: index });
                            autoResizeTextarea(e.target, aiSuggestion?.key === `${item.id}-info_content` ? aiSuggestion.statement : undefined);
                          }}
                          onKeyDown={(e) => handleAutocompleteKeyDown(e, `${item.id}-info_content`, (newVal) => updateItem(item.id, { section_content: newVal }))}
                          placeholder={getPlaceholder(`${item.id}-info_content`, 'Escribe el texto de lectura, recomendaciones o instrucciones para los estudiantes...')}
                          rows={2}
                          className="w-full rounded-lg border border-blue-200 bg-transparent relative z-10 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary overflow-hidden resize-none"
                        />
                        {renderCopilotBadge(`${item.id}-info_content`)}
                      </div>
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
                    <label className="text-xs font-semibold text-gray-700">Enunciado de la pregunta</label>
                    <div className="relative">
                      {renderGhostOverlay(`${item.id}-statement`, item.statement || '', "px-3 py-1.5")}
                      <textarea
                        ref={(el) => autoResizeTextarea(el, aiSuggestion?.key === `${item.id}-statement` ? aiSuggestion.statement : undefined)}
                        value={item.statement || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateItem(item.id, { statement: val });
                          triggerAutocomplete(`${item.id}-statement`, val, 'statement', { itemIndex: index, questionType: item.type });
                          autoResizeTextarea(e.target, aiSuggestion?.key === `${item.id}-statement` ? aiSuggestion.statement : undefined);
                        }}
                        onKeyDown={(e) => handleAutocompleteKeyDown(e, `${item.id}-statement`, (newVal) => updateItem(item.id, { statement: newVal }))}
                        placeholder={getPlaceholder(`${item.id}-statement`, 'Escribe el enunciado...')}
                        rows={2}
                        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm leading-normal font-sans bg-transparent relative z-10 focus:outline-none focus:ring-2 focus:ring-brand-primary overflow-hidden resize-none"
                      />

                      {renderCopilotBadge(`${item.id}-statement`)}
                    </div>

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
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-gray-700">Alternativas</label>
                          {loadingAiKey === `${item.id}-distractors` && <Spinner size="sm" />}
                        </div>
                        {(item.alternatives || []).map((alt, ai) => (
                          <div key={ai} className="flex items-center gap-2">
                            <span className="w-6 text-sm font-bold text-gray-500">{alt.label}</span>
                            <div className="relative flex-1">
                              {renderGhostOverlay(`${item.id}-alt-${ai}`, alt.text || '', "px-3 py-1")}
                              <textarea
                                ref={(el) => autoResizeTextarea(el, aiSuggestion?.key === `${item.id}-alt-${ai}` ? aiSuggestion.statement : undefined)}
                                value={alt.text}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateAlternativeText(item.id, ai, val);
                                  const fType = alt.is_correct ? 'alternative_correct' : 'alternative_distractor';
                                  const otherAlts = (item.alternatives || [])
                                    .filter((_, idx) => idx !== ai)
                                    .map((a) => a.text)
                                    .filter((t) => t && t.trim().length > 0);
                                  triggerAutocomplete(`${item.id}-alt-${ai}`, val, fType, {
                                    itemIndex: index,
                                    questionStatement: item.statement,
                                    questionType: item.type,
                                    existingAlternatives: otherAlts,
                                  });
                                  autoResizeTextarea(e.target, aiSuggestion?.key === `${item.id}-alt-${ai}` ? aiSuggestion.statement : undefined);
                                }}
                                onKeyDown={(e) => {
                                  handleAutocompleteKeyDown(e, `${item.id}-alt-${ai}`, (newVal) => updateAlternativeText(item.id, ai, newVal));
                                  const isLast = ai === (item.alternatives || []).length - 1;
                                  if (e.key === 'Tab' && isLast && !alt.text.trim() && (item.alternatives || []).length < 6) {
                                    e.preventDefault();
                                    handleSuggestDistractors(item);
                                  }
                                }}
                                placeholder={getPlaceholder(`${item.id}-alt-${ai}`, `Alternativa ${alt.label}...`)}
                                rows={1}
                                className={`w-full rounded-lg border px-3 py-1 text-sm bg-transparent relative z-10 focus:outline-none focus:ring-2 overflow-hidden resize-none ${
                                  alt.is_correct
                                    ? 'border-emerald-300 focus:ring-emerald-500 font-medium'
                                    : 'border-gray-300 focus:ring-brand-primary'
                                }`}
                              />
                              {renderCopilotBadge(`${item.id}-alt-${ai}`)}
                            </div>
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
                          {loadingAiKey === `${item.id}-rubric` && <Spinner size="sm" />}
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
                              <div className="relative flex-1">
                                {renderGhostOverlay(`${item.id}-crit_name-${cIdx}`, criterion.name || '', "px-3 py-1.5")}
                                <textarea
                                  ref={(el) => autoResizeTextarea(el, aiSuggestion?.key === `${item.id}-crit_name-${cIdx}` ? aiSuggestion.statement : undefined)}
                                  value={criterion.name}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateCriterionName(item.id, cIdx, val);
                                    triggerAutocomplete(`${item.id}-crit_name-${cIdx}`, val, 'criterion_name', {
                                      itemIndex: index,
                                      questionStatement: item.statement,
                                      criteria: item.criteria,
                                    });
                                    autoResizeTextarea(e.target, aiSuggestion?.key === `${item.id}-crit_name-${cIdx}` ? aiSuggestion.statement : undefined);
                                  }}
                                  onKeyDown={(e) => {
                                    handleAutocompleteKeyDown(e, `${item.id}-crit_name-${cIdx}`, (newVal) => updateCriterionName(item.id, cIdx, newVal));
                                    if (e.key === 'Tab' && !criterion.name.trim() && item.statement?.trim()) {
                                      e.preventDefault();
                                      handleSuggestRubric(item);
                                    }
                                  }}
                                  placeholder={getPlaceholder(`${item.id}-crit_name-${cIdx}`, 'Nombre del criterio (ej: Ortografía)...')}
                                  rows={1}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium bg-transparent relative z-10 focus:outline-none focus:ring-2 focus:ring-brand-primary overflow-hidden resize-none"
                                />
                                {renderCopilotBadge(`${item.id}-crit_name-${cIdx}`)}
                              </div>
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
                                    <div className="relative flex-1">
                                      {renderGhostOverlay(`${item.id}-level_desc-${cIdx}-${lIdx}`, level.description || '', "px-3 py-1")}
                                      <textarea
                                        ref={(el) => autoResizeTextarea(el, aiSuggestion?.key === `${item.id}-level_desc-${cIdx}-${lIdx}` ? aiSuggestion.statement : undefined)}
                                        value={level.description}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          updateCriterionLevel(item.id, cIdx, lIdx, 'description', val);
                                          triggerAutocomplete(`${item.id}-level_desc-${cIdx}-${lIdx}`, val, 'level_description', {
                                            itemIndex: index,
                                            questionStatement: item.statement,
                                            criterionName: criterion.name,
                                            criteria: item.criteria,
                                            currentLevelPoints: level.points,
                                          });
                                          autoResizeTextarea(e.target, aiSuggestion?.key === `${item.id}-level_desc-${cIdx}-${lIdx}` ? aiSuggestion.statement : undefined);
                                        }}
                                        onKeyDown={(e) => handleAutocompleteKeyDown(e, `${item.id}-level_desc-${cIdx}-${lIdx}`, (newVal) => updateCriterionLevel(item.id, cIdx, lIdx, 'description', newVal))}
                                        placeholder={getPlaceholder(`${item.id}-level_desc-${cIdx}-${lIdx}`, 'Descripción del nivel...')}
                                        rows={1}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-1 text-sm bg-transparent relative z-10 focus:outline-none focus:ring-2 focus:ring-brand-primary overflow-hidden resize-none"
                                      />
                                      {renderCopilotBadge(`${item.id}-level_desc-${cIdx}-${lIdx}`)}
                                    </div>
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

        <div className="flex gap-4 items-center flex-wrap">
          <Button type="button" variant="ghost" brand="tiza" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            brand="tiza"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Deshacer (Ctrl+Z)"
            className="flex items-center gap-1.5"
          >
            <Undo2 size={16} /> Deshacer
          </Button>
          <Button
            type="button"
            variant="outline"
            brand="tiza"
            onClick={handleRedo}
            disabled={!canRedo}
            title="Rehacer (Ctrl+Y)"
            className="flex items-center gap-1.5"
          >
            <Redo2 size={16} /> Rehacer
          </Button>
          <Button
            type="button"
            variant="outline"
            brand="tiza"
            onClick={() => setIsPreviewOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Eye size={16} /> Previsualizar
          </Button>
          <Button type="submit" brand="tiza" loading={createEval.isPending}>
            Crear evaluación
          </Button>
        </div>
      </form>

      <EvaluationPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={title}
        subject={selectedClass?.subject}
        grade={selectedClass?.grade}
        items={items}
      />
    </div>
  );
}

