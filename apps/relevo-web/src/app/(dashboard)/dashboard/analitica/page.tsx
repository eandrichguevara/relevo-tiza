'use client';

import { Card, Badge } from '@tiza/ui';
import { useActiveTenant } from '@/hooks/ActiveTenantContext';
import { FileText, Cpu, Users, Clock, TrendingUp, ArrowUp, ArrowDown, School } from 'lucide-react';

// ─── Mock data ─────────────────────────────────────────────

const kpis: {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  icon: React.ElementType;
  description: string;
}[] = [
  {
    label: 'Total evaluaciones procesadas',
    value: '3,450',
    change: '+12.5%',
    trend: 'up',
    icon: FileText,
    description: 'vs. mes anterior',
  },
  {
    label: 'Tasa de corrección IA',
    value: '94.2%',
    change: '+2.1%',
    trend: 'up',
    icon: Cpu,
    description: 'precisión promedio',
  },
  {
    label: 'Profesores activos',
    value: '24',
    change: '+3',
    trend: 'up',
    icon: Users,
    description: 'este mes',
  },
  {
    label: 'Tiempo ahorrado',
    value: '1,280',
    change: '+8.3%',
    trend: 'up',
    icon: Clock,
    description: 'horas acumuladas',
  },
];

const evaluacionesPorMes = [
  { mes: 'Ene', cantidad: 280 },
  { mes: 'Feb', cantidad: 210 },
  { mes: 'Mar', cantidad: 340 },
  { mes: 'Abr', cantidad: 390 },
  { mes: 'May', cantidad: 410 },
  { mes: 'Jun', cantidad: 380 },
  { mes: 'Jul', cantidad: 260 },
  { mes: 'Ago', cantidad: 420 },
  { mes: 'Sep', cantidad: 450 },
  { mes: 'Oct', cantidad: 470 },
  { mes: 'Nov', cantidad: 430 },
  { mes: 'Dic', cantidad: 360 },
];

const maxEvaluaciones = Math.max(...evaluacionesPorMes.map((e) => e.cantidad));

const eficienciaData = [
  { mes: 'Ene', ia: 65, manual: 35 },
  { mes: 'Feb', ia: 68, manual: 32 },
  { mes: 'Mar', ia: 72, manual: 28 },
  { mes: 'Abr', ia: 75, manual: 25 },
  { mes: 'May', ia: 80, manual: 20 },
  { mes: 'Jun', ia: 82, manual: 18 },
  { mes: 'Jul', ia: 84, manual: 16 },
  { mes: 'Ago', ia: 88, manual: 12 },
  { mes: 'Sep', ia: 91, manual: 9 },
  { mes: 'Oct', ia: 93, manual: 7 },
  { mes: 'Nov', ia: 94, manual: 6 },
  { mes: 'Dic', ia: 95, manual: 5 },
];

// ─── Subcomponents ─────────────────────────────────────────

function StatCard({
  label,
  value,
  change,
  trend,
  icon: Icon,
  description,
}: {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  icon: React.ElementType;
  description: string;
}) {
  return (
    <Card brand="relevo">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 truncate">{label}</p>
          <p className="text-3xl font-bold text-brand-primary mt-1">{value}</p>
          <div className="flex items-center gap-1 mt-2">
            {trend === 'up' ? (
              <ArrowUp size={14} className="text-green-600" />
            ) : (
              <ArrowDown size={14} className="text-red-500" />
            )}
            <span
              className={`text-xs font-medium ${
                trend === 'up' ? 'text-green-600' : 'text-red-500'
              }`}
            >
              {change}
            </span>
            <span className="text-xs text-gray-400 ml-1">{description}</span>
          </div>
        </div>
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand-light flex items-center justify-center ml-3">
          <Icon size={20} className="text-brand-primary" />
        </div>
      </div>
    </Card>
  );
}

function BarChart({
  data,
  maxValue,
  color,
}: {
  data: { mes: string; cantidad: number }[];
  maxValue: number;
  color: string;
}) {
  return (
    <div
      className="flex items-end gap-1.5 h-48 pt-4"
      role="img"
      aria-label="Gráfico de barras de evaluaciones por mes"
    >
      {data.map((item) => {
        const height = (item.cantidad / maxValue) * 100;
        return (
          <div
            key={item.mes}
            className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
          >
            <span className="text-[10px] text-gray-400 font-medium">{item.cantidad}</span>
            <div
              className="w-full rounded-t-md transition-all duration-500 hover:opacity-80"
              style={{
                height: `${height}%`,
                backgroundColor: color,
                minHeight: '4px',
              }}
              title={`${item.mes}: ${item.cantidad} evaluaciones`}
            />
            <span className="text-[10px] text-gray-500 font-medium mt-1">{item.mes}</span>
          </div>
        );
      })}
    </div>
  );
}

function StackedBarChart({ data }: { data: { mes: string; ia: number; manual: number }[] }) {
  return (
    <div
      className="flex items-end gap-1.5 h-48 pt-4"
      role="img"
      aria-label="Gráfico de barras apiladas de eficiencia IA"
    >
      {data.map((item) => {
        const total = item.ia + item.manual;
        const iaHeight = (item.ia / 100) * 100;
        const manualHeight = (item.manual / 100) * 100;
        return (
          <div
            key={item.mes}
            className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
          >
            <span className="text-[10px] text-gray-400 font-medium">{item.ia}%</span>
            <div
              className="w-full rounded-t-md flex flex-col-reverse transition-all duration-500"
              style={{ height: `${iaHeight + manualHeight}%`, minHeight: '4px' }}
            >
              {/* IA portion */}
              <div
                className="w-full rounded-t-md"
                style={{
                  height: `${(item.ia / (item.ia + item.manual)) * 100}%`,
                  backgroundColor: '#1A3A5C',
                }}
                title={`${item.mes}: IA ${item.ia}%`}
              />
              {/* Manual portion */}
              <div
                className="w-full"
                style={{
                  height: `${(item.manual / (item.ia + item.manual)) * 100}%`,
                  backgroundColor: '#E2E8F0',
                }}
                title={`${item.mes}: Manual ${item.manual}%`}
              />
            </div>
            <span className="text-[10px] text-gray-500 font-medium mt-1">{item.mes}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────

export default function AnaliticaPage() {
  const { activeTenant } = useActiveTenant();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Analítica avanzada</h1>
          <p className="text-gray-500">Métricas de rendimiento y uso del sistema</p>
        </div>
        <div className="flex items-center gap-3">
          {activeTenant && (
            <Badge variant="info">
              <School size={14} className="mr-1" />
              {activeTenant.name}
            </Badge>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <TrendingUp size={16} className="text-brand-primary" />
            <span>Actualizado: Jul 2026</span>
          </div>
        </div>
      </div>

      {/* ─── KPI Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <StatCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* ─── Charts Row ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card title="Evaluaciones por mes" subtitle="Enero — Diciembre 2026" brand="relevo">
          <BarChart data={evaluacionesPorMes} maxValue={maxEvaluaciones} color="#1A3A5C" />
        </Card>

        <Card
          title="Eficiencia de corrección IA"
          subtitle="Porcentaje de evaluaciones corregidas por IA vs. manual"
          brand="relevo"
        >
          <div className="mb-2">
            <StackedBarChart data={eficienciaData} />
            <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#1A3A5C]" />
                <span>Corrección IA</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#E2E8F0]" />
                <span>Corrección manual</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Bottom insights ──────────────────────────── */}
      <Card brand="relevo">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="text-sm font-semibold text-brand-primary mb-2">Por colegio</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Colegio San Miguel</span>
                <span className="font-medium">1,240 eval.</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Liceo Gabriela Mistral</span>
                <span className="font-medium">980 eval.</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Instituto Nacional</span>
                <span className="font-medium">720 eval.</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Colegio Los Olivos</span>
                <span className="font-medium">510 eval.</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-brand-primary mb-2">Por asignatura</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Matemáticas</span>
                <span className="font-medium">890 eval.</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Lenguaje</span>
                <span className="font-medium">760 eval.</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Ciencias</span>
                <span className="font-medium">540 eval.</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Historia</span>
                <span className="font-medium">410 eval.</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-brand-primary mb-2">
              Tiempo ahorrado por rol
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Profesores</span>
                <span className="font-medium">840 hrs</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Coordinadores</span>
                <span className="font-medium">320 hrs</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Directivos</span>
                <span className="font-medium">120 hrs</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
