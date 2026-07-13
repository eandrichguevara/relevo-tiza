'use client';

import { Card, Button, Badge } from '@tiza/ui';
import { CreditCard, Download } from 'lucide-react';

export default function FacturacionPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-primary mb-2">Facturaci&oacute;n</h1>
      <p className="text-gray-500 mb-8">Gesti&oacute;n de planes y pagos</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card title="Plan actual">
          <Badge variant="info" className="mb-2">
            Profesional
          </Badge>
          <p className="text-3xl font-bold text-brand-primary">
            $4,500<span className="text-sm font-normal text-gray-500">/a&ntilde;o</span>
          </p>
          <p className="text-sm text-gray-500 mt-1">3 colegios incluidos</p>
        </Card>
        <Card title="Pr&oacute;ximo cobro">
          <p className="text-3xl font-bold">15 Ene 2027</p>
          <p className="text-sm text-gray-500 mt-1">Renovaci&oacute;n anual</p>
        </Card>
        <Card title="M&eacute;todo de pago">
          <CreditCard className="text-gray-400 mb-2" size={24} />
          <p className="text-sm text-gray-500">Configuraci&oacute;n pr&oacute;ximamente</p>
          <Button brand="relevo" variant="outline" size="sm" className="mt-2">
            Agregar m&eacute;todo
          </Button>
        </Card>
      </div>

      <Card title="Historial de facturas">
        <div className="space-y-2">
          {[
            { id: 'INV-001', date: '15 Ene 2026', amount: '$4,500', status: 'Pagada' },
            { id: 'INV-002', date: '15 Ene 2025', amount: '$4,500', status: 'Pagada' },
          ].map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div>
                <p className="font-medium">{inv.id}</p>
                <p className="text-sm text-gray-500">{inv.date}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium">{inv.amount}</span>
                <Badge variant="success">{inv.status}</Badge>
                <button className="text-gray-400 hover:text-brand-primary">
                  <Download size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
