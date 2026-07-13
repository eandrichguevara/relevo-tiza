'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Input, Button, Spinner } from '@tiza/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useCreateEvaluation } from '@/hooks/useApi';

const SUBJECTS = ['Lenguaje', 'Matemáticas', 'Ciencias', 'Historia', 'Inglés'];
const GRADES = [
  '1° básico', '2° básico', '3° básico', '4° básico',
  '5° básico', '6° básico', '7° básico', '8° básico',
  'I medio', 'II medio', 'III medio', 'IV medio',
];

interface Question {
  question_number: number;
  type: 'written' | 'multiple_choice';
  max_score: number;
  correct_answer: string;
  criteria: string;
}

export default function NuevaEvaluacionPage() {
  const router = useRouter();
  const createEval = useCreateEvaluation();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Lenguaje');
  const [grade, setGrade] = useState('1° básico');
  const [questions, setQuestions] = useState<Question[]>([
    { question_number: 1, type: 'written', max_score: 5, correct_answer: '', criteria: '' },
  ]);

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      { question_number: prev.length + 1, type: 'written', max_score: 5, correct_answer: '', criteria: '' },
    ]);
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) =>
      prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, question_number: i + 1 }))
    );
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, [field]: value } : q)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createEval.mutateAsync({ title, subject, grade, rubric: questions });
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Título de la evaluación"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Prueba de Lenguaje 5° básico"
              required
            />
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                Asignatura
              </label>
              <select
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="grade" className="block text-sm font-medium text-gray-700 mb-1">
                Curso
              </label>
              <select
                id="grade"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <Card title="Rúbrica de preguntas" subtitle="Define cada pregunta y su puntaje">
          <div className="space-y-4">
            {questions.map((q, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-brand-primary mt-2">Q{q.question_number}</span>
                <div className="flex-1 space-y-2">
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
                    <div className="w-28">
                      <Input
                        label=""
                        type="number"
                        min={0}
                        max={100}
                        value={q.max_score}
                        onChange={(e) => updateQuestion(index, 'max_score', Number(e.target.value))}
                        placeholder="Puntaje máx"
                      />
                    </div>
                    {q.type === 'multiple_choice' && (
                      <div className="flex-1">
                        <Input
                          label=""
                          value={q.correct_answer}
                          onChange={(e) => updateQuestion(index, 'correct_answer', e.target.value)}
                          placeholder="Resp. correcta"
                        />
                      </div>
                    )}
                  </div>
                  {q.type === 'written' && (
                    <Input
                      label=""
                      value={q.criteria}
                      onChange={(e) => updateQuestion(index, 'criteria', e.target.value)}
                      placeholder="Criterio de evaluación (opcional)"
                    />
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
