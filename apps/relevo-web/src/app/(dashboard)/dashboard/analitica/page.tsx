'use client';

import { Card } from '@tiza/ui';
import { BarChart3, PieChart, Activity } from 'lucide-react';

export default function AnaliticaPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-primary mb-6">Anal&iacute;tica avanzada</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Rendimiento por asignatura">
          <div className="h-48 flex items-center justify-center text-gray-400">
            <BarChart3 size={48} />
            <span className="ml-2">Gr&aacute;fico pr&oacute;ximamente</span>
          </div>
        </Card>
        <Card title="Distribuci&oacute;n por curso">
          <div className="h-48 flex items-center justify-center text-gray-400">
            <PieChart size={48} />
            <span className="ml-2">Gr&aacute;fico pr&oacute;ximamente</span>
          </div>
        </Card>
        <Card title="Evoluci&oacute;n temporal" className="md:col-span-2">
          <div className="h-48 flex items-center justify-center text-gray-400">
            <Activity size={48} />
            <span className="ml-2">L&iacute;nea de tiempo pr&oacute;ximamente</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
