import React from 'react';
import { AlertTriangle, FileSpreadsheet, X } from 'lucide-react';

export interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  details?: { label: string; value: string }[];
  confirmLabel: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  title,
  description,
  details = [],
  confirmLabel,
  cancelLabel = 'Batal',
  variant = 'primary',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                variant === 'danger'
                  ? 'bg-red-50 text-red-600'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {variant === 'danger' ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <FileSpreadsheet className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3
                id="confirm-modal-title"
                className="text-base font-semibold text-slate-900"
              >
                {title}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Konfirmasi perubahan data Google Sheets
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Tutup dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          {description}
        </p>

        {details.length > 0 && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2">
            {details.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-4 text-xs"
              >
                <span className="text-slate-500">{item.label}</span>
                <span className="font-mono font-medium text-slate-900 text-right truncate max-w-[240px]">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors whitespace-nowrap ${
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
                : 'bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400'
            }`}
          >
            {isLoading ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
