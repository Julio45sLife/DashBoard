'use client';

import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  loading?: boolean;
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, description,
  confirmLabel = 'Confirmer', confirmVariant = 'danger', loading,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      {description && <p className="text-sm text-gray-600 mb-6">{description}</p>}
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="btn-secondary">Annuler</button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={confirmVariant === 'danger' ? 'btn-danger' : 'btn-primary'}
        >
          {loading ? (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
