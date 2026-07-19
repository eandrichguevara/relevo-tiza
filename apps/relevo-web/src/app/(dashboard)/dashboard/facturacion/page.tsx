'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Badge, EmptyState } from '@tiza/ui';
import { useFeatures } from '@/hooks/useFeatures';
import {
  CreditCard,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
  Shield,
  Building2,
  Users,
  FileText,
  Headphones,
  Zap,
  ChevronDown,
  Lock,
} from 'lucide-react';

// ─── Mock data ─────────────────────────────────────────────

const PLAN_ACTUAL = {
  name: 'Profesional',
  price: 4500,
  currency: '$',
  period: 'año',
  features: [
    'Hasta 5 colegios',
    'Profesores ilimitados',
    'Evaluaciones con IA ilimitadas',
    'Analítica avanzada',
    'Soporte prioritario 24/7',
    'API de integración',
    'Exportación de datos',
    'Múltiples usuarios administradores',
  ],
};

const METODO_PAGO = {
  type: 'Visa',
  last4: '4242',
  expiry: '12/27',
  holder: 'Director RELEVO',
};

const PRÓXIMO_COBRO = {
  fecha: '15 Jul 2026',
  concepto: 'Renovación anual Plan Profesional',
  monto: 4500,
};

const FACTURAS = [
  {
    id: 'INV-2026-007',
    fecha: '15 Jun 2026',
    concepto: 'Plan Profesional — Renovación anual',
    monto: 4500,
    estado: 'Pagado' as const,
  },
  {
    id: 'INV-2026-006',
    fecha: '15 May 2026',
    concepto: 'Colegio adicional — San Miguel',
    monto: 400,
    estado: 'Pagado' as const,
  },
  {
    id: 'INV-2026-005',
    fecha: '15 Abr 2026',
    concepto: 'Colegio adicional — Los Olivos',
    monto: 400,
    estado: 'Pagado' as const,
  },
  {
    id: 'INV-2026-004',
    fecha: '15 Mar 2026',
    concepto: 'Plan Profesional — Cuota trimestral',
    monto: 1200,
    estado: 'Pagado' as const,
  },
  {
    id: 'INV-2026-003',
    fecha: '15 Feb 2026',
    concepto: 'Módulo Analítica Avanzada — Activación',
    monto: 250,
    estado: 'Pagado' as const,
  },
  {
    id: 'INV-2026-002',
    fecha: '15 Ene 2026',
    concepto: 'Usuarios adicionales — 5 licenses extra',
    monto: 180,
    estado: 'Pendiente' as const,
  },
];

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('es-CL')}`;
}

function getEstadoBadge(estado: 'Pagado' | 'Pendiente') {
  if (estado === 'Pagado') {
    return (
      <Badge variant="success" className="flex items-center gap-1">
        <CheckCircle size={12} />
        Pagado
      </Badge>
    );
  }
  return (
    <Badge variant="warning" className="flex items-center gap-1">
      <Clock size={12} />
      Pendiente
    </Badge>
  );
}

// ─── Page ──────────────────────────────────────────────────

export default function FacturacionPage() {
  const router = useRouter();
  const { features, isLoaded } = useFeatures();
  const [showFeatures, setShowFeatures] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // Si billing no está activo, mostrar mensaje de funcionalidad no disponible
  if (isLoaded && !features.billing) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <EmptyState
          icon={<Lock size={48} />}
          title="Facturación no disponible"
          description="El módulo de facturación no está habilitado para tu plan actual. Contacta a tu administrador para más información."
          action={
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-accent transition-colors text-sm font-medium"
            >
              Volver al dashboard
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      {/* ─── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Facturación</h1>
          <p className="text-gray-500">Gestión de planes, pagos y facturas</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2">
          <Shield size={16} className="text-green-600" />
          <span>Pagos seguros SSL</span>
        </div>
      </div>

      {/* ─── Plan & Payment Summary ──────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Plan actual */}
        <Card title="Plan actual" brand="relevo">
          <div className="flex items-start justify-between mb-3">
            <Badge variant="info">Profesional</Badge>
            <div className="relative">
              <button
                type="button"
                className="text-xs text-brand-primary hover:underline focus:outline-none focus:ring-2 focus:ring-brand-primary rounded"
                onClick={() => setShowFeatures(!showFeatures)}
                aria-expanded={showFeatures}
                aria-label="Ver características del plan"
              >
                {showFeatures ? 'Ocultar' : 'Ver'} características
              </button>
            </div>
          </div>

          <p className="text-3xl font-bold text-brand-primary">
            {formatCurrency(PLAN_ACTUAL.price)}
            <span className="text-sm font-normal text-gray-500">/{PLAN_ACTUAL.period}</span>
          </p>

          {showFeatures && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <ul className="space-y-1.5">
                {PLAN_ACTUAL.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <div className="relative group">
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                onMouseEnter={() => setTooltipVisible(true)}
                onMouseLeave={() => setTooltipVisible(false)}
                onFocus={() => setTooltipVisible(true)}
                onBlur={() => setTooltipVisible(false)}
                aria-disabled="true"
                aria-label="Cambiar plan — próximamente disponible"
              >
                Cambiar plan
                <ChevronDown size={14} />
              </button>
              {tooltipVisible && (
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap"
                  role="tooltip"
                >
                  Próximamente
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              )}
            </div>
            <span className="text-xs text-gray-400">Planes desde $3,000/año</span>
          </div>
        </Card>

        {/* Próximo cobro */}
        <Card title="Próximo cobro" brand="relevo">
          <p className="text-3xl font-bold text-brand-primary">
            {formatCurrency(PRÓXIMO_COBRO.monto)}
          </p>
          <p className="text-sm text-gray-500 mt-1">{PRÓXIMO_COBRO.fecha}</p>
          <p className="text-xs text-gray-400 mt-1">{PRÓXIMO_COBRO.concepto}</p>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm">
            <Clock size={14} className="text-gray-400" />
            <span className="text-gray-500">Faltan 30 días</span>
          </div>
        </Card>

        {/* Método de pago */}
        <Card title="Método de pago" brand="relevo">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-8 rounded bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
              <CreditCard size={18} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">
                {METODO_PAGO.type} ****{METODO_PAGO.last4}
              </p>
              <p className="text-xs text-gray-500">
                Vence {METODO_PAGO.expiry} — {METODO_PAGO.holder}
              </p>
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <CheckCircle size={14} className="text-green-600 flex-shrink-0" />
            <span className="text-xs text-green-700">Método de pago verificado</span>
          </div>
        </Card>
      </div>

      {/* ─── Plan comparison mini ────────────────────── */}
      <Card title="Planes disponibles" brand="relevo" className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              name: 'Small',
              price: 3000,
              popular: false,
              colegios: '1 colegio',
              profesores: 'Hasta 20',
              ia: 'Básica',
            },
            {
              name: 'Medium',
              price: 4000,
              popular: false,
              colegios: 'Hasta 3',
              profesores: 'Hasta 50',
              ia: 'Avanzada',
            },
            {
              name: 'Large',
              price: 5000,
              popular: false,
              colegios: 'Ilimitados',
              profesores: 'Ilimitados',
              ia: 'Premium',
            },
          ].map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-xl border p-4 ${
                plan.name === 'Profesional'
                  ? 'border-brand-primary bg-brand-light'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {plan.name === 'Profesional' && (
                <span className="absolute -top-2.5 left-4 bg-brand-primary text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  Plan actual
                </span>
              )}
              <h4 className="font-bold text-gray-900">{plan.name}</h4>
              <p className="text-2xl font-bold text-brand-primary mt-1">
                {formatCurrency(plan.price)}
                <span className="text-xs font-normal text-gray-500">/año</span>
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-gray-600">
                <li className="flex items-center gap-1.5">
                  <Building2 size={12} className="text-gray-400" />
                  {plan.colegios}
                </li>
                <li className="flex items-center gap-1.5">
                  <Users size={12} className="text-gray-400" />
                  {plan.profesores}
                </li>
                <li className="flex items-center gap-1.5">
                  <Zap size={12} className="text-gray-400" />
                  IA {plan.ia}
                </li>
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {/* ─── Invoice History ─────────────────────────── */}
      <Card title="Historial de facturas" brand="relevo" padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table" aria-label="Historial de facturas">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-3 px-4 font-medium text-gray-500">Folio</th>
                <th className="py-3 px-4 font-medium text-gray-500">Fecha</th>
                <th className="py-3 px-4 font-medium text-gray-500 hidden sm:table-cell">
                  Concepto
                </th>
                <th className="py-3 px-4 font-medium text-gray-500 text-right">Monto</th>
                <th className="py-3 px-4 font-medium text-gray-500">Estado</th>
                <th className="py-3 px-4 font-medium text-gray-500 sr-only">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {FACTURAS.map((factura) => (
                <tr
                  key={factura.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-3 px-4 font-mono text-xs text-gray-900">{factura.id}</td>
                  <td className="py-3 px-4 text-gray-600">{factura.fecha}</td>
                  <td
                    className="py-3 px-4 text-gray-500 hidden sm:table-cell max-w-[200px] truncate"
                    title={factura.concepto}
                  >
                    {factura.concepto}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900">
                    {formatCurrency(factura.monto)}
                  </td>
                  <td className="py-3 px-4">{getEstadoBadge(factura.estado)}</td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-brand-primary hover:bg-brand-light transition-colors"
                      aria-label={`Descargar factura ${factura.id}`}
                      title="Descargar PDF"
                    >
                      <Download size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {FACTURAS.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>Mostrando {FACTURAS.length} facturas</span>
            <span className="flex items-center gap-1">
              <FileText size={12} />
              Descarga disponible en PDF
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}
