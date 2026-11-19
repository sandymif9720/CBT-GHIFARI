import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'danger',
  loading = false,
}) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidthClass="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 ${
              variant === 'danger'
                ? 'bg-[#DC2626] hover:bg-red-700'
                : 'bg-[#2563EB] hover:bg-blue-700'
            }`}
          >
            {loading ? 'Memproses...' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3.5">
        <div
          className={`p-2.5 rounded-lg shrink-0 ${
            variant === 'danger' ? 'bg-red-50 text-[#DC2626]' : 'bg-blue-50 text-[#2563EB]'
          }`}
        >
          <AlertTriangle className="w-5 h-5" />
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{message}</p>
      </div>
    </Modal>
  );
};
