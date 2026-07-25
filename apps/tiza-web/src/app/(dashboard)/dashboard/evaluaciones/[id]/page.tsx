'use client';

import { useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Card, Button, Badge, Spinner, EmptyState } from '@tiza/ui';
import { useAuth } from '@/hooks/useAuth';
import { Upload, FileText, Download, AlertTriangle, CheckCircle, Eye } from 'lucide-react';
import { useEvaluation, useResults, useProcessEvaluation, useGenerateReport } from '@/hooks/useApi';
import Link from 'next/link';

export default function EvaluationDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { token } = useAuth();
  const { data: evaluation, isLoading } = useEvaluation(id);
  const { data: results, isLoading: resultsLoading } = useResults(id);
  const processEval = useProcessEvaluation();
  const generateReport = useGenerateReport();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await processEval.mutateAsync({ evaluationId: id, file });
      alert('¡Procesamiento iniciado!');
    } catch (err: any) {
      alert('Error al procesar: ' + err.message);
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGeneratePDF = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/evaluations/${id}/pdf`, {
        headers: {
          Authorization: `Bearer ${token || ''}`,
          'X-Tenant-Brand': 'tiza',
        },
      });
      if (!res.ok) throw new Error('Error al generar PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url);
    } catch (err) {
      alert('Error al generar PDF');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!evaluation) {
    return <EmptyState title="Evaluación no encontrada" />;
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/evaluaciones"
          className="text-brand-primary text-sm hover:underline mb-2 inline-block"
        >
          ← Volver a evaluaciones
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-brand-secondary">{evaluation.title}</h1>
            <p className="text-gray-500">
              {evaluation.subject} — {evaluation.grade}
            </p>
          </div>
          <Badge
            variant={
              evaluation.status === 'completed' || evaluation.status === 'reviewed'
                ? 'success'
                : 'warning'
            }
          >
            {evaluation.status}
          </Badge>
        </div>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <h3 className="font-semibold mb-3">Generar PDF</h3>
          <p className="text-sm text-gray-500 mb-4">Descarga la evaluación lista para imprimir</p>
          <Button brand="tiza" variant="outline" onClick={handleGeneratePDF} className="w-full">
            <Download size={16} className="mr-1" /> Descargar PDF
          </Button>
        </Card>
        <Card>
          <h3 className="font-semibold mb-3">Subir escaneo</h3>
          <p className="text-sm text-gray-500 mb-4">Sube el PDF escaneado para corregir</p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            accept=".pdf"
            className="hidden"
            aria-label="Seleccionar archivo PDF escaneado"
          />
          <Button
            brand="tiza"
            onClick={() => fileInputRef.current?.click()}
            loading={uploading || processEval.isPending}
            className="w-full"
          >
            <Upload size={16} className="mr-1" /> Subir y procesar
          </Button>
        </Card>
        <Card>
          <h3 className="font-semibold mb-3">Estructura y Rúbrica</h3>
          <p className="text-sm text-gray-500">
            {Array.isArray(evaluation.rubric)
              ? (() => {
                  const questionsCount = evaluation.rubric.filter(
                    (it: any) => it.item_type !== 'info_section'
                  ).length;
                  const sectionsCount = evaluation.rubric.filter(
                    (it: any) => it.item_type === 'info_section'
                  ).length;
                  return `${questionsCount} preguntas` + (sectionsCount > 0 ? `, ${sectionsCount} sección(es)` : '');
                })()
              : 'Sin rúbrica'}
          </p>
        </Card>
      </div>

      {/* Results section */}
      <Card title="Resultados">
        {resultsLoading ? (
          <Spinner />
        ) : !results || results.length === 0 ? (
          <EmptyState
            title="Sin resultados"
            description="Sube un PDF escaneado para procesar las respuestas"
            icon={<FileText size={48} />}
          />
        ) : (
          <div className="space-y-3">
            {results.map((result: any) => (
              <div
                key={result.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {result.requires_review ? (
                    <AlertTriangle size={20} className="text-yellow-500" />
                  ) : (
                    <CheckCircle size={20} className="text-green-500" />
                  )}
                  <div>
                    <p className="font-medium">{result.student_code}</p>
                    <p className="text-sm text-gray-500">
                      Nota: {result.final_grade?.toFixed(1) || '—'} | Confianza:{' '}
                      {Math.round(result.confidence * 100)}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={result.requires_review ? 'warning' : 'success'}>
                    {result.requires_review ? 'Revisar' : 'OK'}
                  </Badge>
                  <Link
                    href={`/dashboard/revisar/${result.id}`}
                    aria-label={`Revisar resultado de ${result.student_code}`}
                  >
                    <Button brand="tiza" variant="ghost" size="sm">
                      <Eye size={16} />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
