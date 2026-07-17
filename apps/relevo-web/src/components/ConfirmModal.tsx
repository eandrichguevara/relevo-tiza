'use client';

import { Button } from '@tiza/ui';
import type { ReactNode } from 'react';

export interface ConfirmModalProps {
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger';
  loading?: boolean;
}

export default function ConfirmModal({
  title,
  children,
  onConfirm,
  onCancel,
  confirmLabel,
  confirmVariant = 'primary',
  loading = false,
}: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 z-10">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="text-sm text-gray-600 mb-6">{children}</div>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" brand="relevo" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant={confirmVariant}
            brand="relevo"
            onClick={onConfirm}
            loading={loading}
            disabled={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
