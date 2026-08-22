import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Info } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => unknown | Promise<unknown>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

const TONE = {
  danger: {
    icon: AlertTriangle,
    iconBox: 'border-red-200 bg-red-50 text-red-500 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-400',
    button: 'bg-red-500 text-white hover:bg-red-600 dark:hover:bg-red-400',
  },
  warning: {
    icon: AlertTriangle,
    iconBox: 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400',
    button: 'bg-amber-500 text-zinc-950 hover:bg-amber-400',
  },
  info: {
    icon: Info,
    iconBox: 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-400',
    button: 'bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500',
  },
};

/** Diálogo curto de confirmação, sempre centralizado na viewport. */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'danger',
}) => {
  const tone = TONE[type];
  const Icon = tone.icon;
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!isOpen) { setSubmitting(false); setError(''); }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível concluir a exclusão.');
    } finally {
      setSubmitting(false);
    }
  };

  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            aria-describedby="confirm-modal-description"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-sm overflow-hidden rounded-3xl border border-zinc-200 bg-white text-zinc-900 shadow-2xl dark:border-white/10 dark:bg-zinc-950 dark:text-white"
          >
            <div className="px-6 pb-7 pt-6 text-center sm:px-8 sm:pb-8 sm:pt-7">
              <div className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border ${tone.iconBox}`}>
                <Icon size={27} strokeWidth={1.8} aria-hidden />
              </div>
              <h3 id="confirm-modal-title" className="font-display text-base font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                {title}
              </h3>
              <p id="confirm-modal-description" className="mx-auto mt-2 max-w-xs text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
                {message}
              </p>
              {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
            </div>

            <div className="grid grid-cols-2 border-t border-zinc-200 dark:border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="min-h-14 border-r border-zinc-200 bg-white px-4 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-400 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={submitting}
                className={`min-h-14 px-4 text-[10px] font-black uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 ${tone.button}`}
              >
                {submitting ? 'Excluindo…' : confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
