'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Input, Button, Badge, Spinner } from '@tiza/ui';
import { useResult, useReviewResult, useGenerateReport } from '@/hooks/useApi';
import { AlertTriangle, CheckCircle, Download, Save } from 'lucide-react';
import Link from 'next/link';

interface Correction {
  score: number;
  feedback: string;
}

interface Answer {
  question_number: number;
  score: number;
  teacher_score?: number;
  max_score: number;
  student_answer?: string;
  ai_feedback?: string;
  teacher_correction?: string;
  requires_review?: boolean;
}

export default function ReviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: result, isLoading } = useResult(id);
  const reviewMutation = useReviewResult();
  const generateReport = useGenerateReport();
  const [corrections, setCorrections] = useState<Record<number, Correction>>({});

  useEffect(() => {
    if (result?.answers) {
      const initial: Record<number, Correction> = {};
      result.answers.forEach((a: Answer) => {
        initial[a.question_number] = {
          score: a.teacher_score ?? a.score ?? 0,
          feedback: a.teacher_correction ?? a.ai_feedback ?? '',
        };
      });
      setCorrections(initial);
    }
  }, [result]);

  const handleSave = async () => {
    try {
      const correctionsList = Object.entries(corrections).map(([qNum, data]) => ({
        question_number: parseInt(qNum),
        teacher_score: data.score,
        teacher_correction: data.feedback,
      }));

      await reviewMutation.mutateAsync({ resultId: id, corrections: correctionsList });
      alert('¡Revisión guardada!');
      router.push('/dashboard/revisar');
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!result) {
    return <p className="text-center py-12 text-gray-500">Resultado no encontrado</p>;
  }

  return (
    <div>
      <Link href="/dashboard/revisar" className="text-brand-primary text-sm hover:underline mb-2 inline-block">
        ← Volver a pendientes
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-secondary">Revisión: {result.student_code}</h1>
          <p className="text-gray-500">
            Confianza IA: {Math.round(result.confidence * 100)}% | Nota sugerida:{' '}
            {result.final_grade?.toFixed(1) || '—'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button brand="tiza" variant="outline" onClick={() => generateReport.mutate(id)}>
            <Download size={16} className="mr-1" /> Reporte
          </Button>
          <Button brand="tiza" onClick={handleSave} loading={reviewMutation.isPending}>
            <Save size={16} className="mr-1" /> Guardar revisión
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {(Array.isArray(result.answers) ? result.answers : []).map((answer: Answer) => (
          <Card key={answer.question_number}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold">
                Pregunta {answer.question_number} — {answer.max_score} pts
              </h3>
              {answer.requires_review ? (
                <Badge variant="warning">
                  <AlertTriangle size={12} className="inline mr-1" /> Revisar
                </Badge>
              ) : (
                <Badge variant="success">
                  <CheckCircle size={12} className="inline mr-1" /> OK
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Respuesta del alumno:</p>
                <p className="text-sm bg-gray-50 p-3 rounded-lg italic">
                  {answer.student_answer || '(sin respuesta)'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Feedback IA:</p>
                <p className="text-sm bg-blue-50 p-3 rounded-lg">
                  {answer.ai_feedback || 'Sin feedback'}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Tu puntuación"
                type="number"
                min={0}
                max={answer.max_score}
                value={corrections[answer.question_number]?.score ?? answer.score}
                onChange={(e) =>
                  setCorrections((prev) => ({
                    ...prev,
                    [answer.question_number]: {
                      ...prev[answer.question_number],
                      score: Number(e.target.value),
                    },
                  }))
                }
              />
              <Input
                label="Tu feedback"
                value={corrections[answer.question_number]?.feedback ?? ''}
                onChange={(e) =>
                  setCorrections((prev) => ({
                    ...prev,
                    [answer.question_number]: {
                      ...prev[answer.question_number],
                      feedback: e.target.value,
                    },
                  }))
                }
                placeholder="Retroalimentación para el alumno..."
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
