import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ConfirmStrongModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: React.ReactNode;
  /** Texto que o usuário precisa digitar para liberar o botão. Ex: nome da empresa. */
  confirmText: string;
  /** Label do botão final. */
  confirmLabel?: string;
  /** Conteúdo extra renderizado entre descrição e input (ex: opções soft/hard). */
  extra?: React.ReactNode;
  /** Texto de aviso destacado no topo. */
  warningHighlight?: string;
}

export function ConfirmStrongModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  confirmLabel = 'Confirmar exclusão',
  extra,
  warningHighlight,
}: ConfirmStrongModalProps) {
  const [typed, setTyped] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setTyped('');
      setError('');
      setSubmitting(false);
      return;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  const matches = typed.trim() === confirmText.trim();

  const handleConfirm = async () => {
    if (!matches || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Falha ao executar ação.');
    } finally {
      setSubmitting(false);
    }
  };

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-confirm flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md bg-zinc-950/95 backdrop-blur-xl border border-red-900/40 rounded-3xl shadow-2xl shadow-red-900/20 overflow-hidden"
          >
            <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 w-60 h-60 rounded-full bg-red-500/15 blur-[100px]" />

            <header className="relative flex items-start gap-4 p-6 border-b border-white/5">
              <div className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="text-red-400" size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-black text-lg uppercase tracking-widest text-white">{title}</h3>
                {warningHighlight && (
                  <p className="text-[11px] font-bold uppercase tracking-widest text-red-400 mt-1">{warningHighlight}</p>
                )}
              </div>
              <button
                onClick={onClose}
                disabled={submitting}
                className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-40"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </header>

            <div className="relative p-6 space-y-4">
              <div className="text-sm text-zinc-300 leading-relaxed">{description}</div>

              {extra}

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">
                  Digite <code className="text-red-400 font-mono">{confirmText}</code> para confirmar
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={typed}
                  disabled={submitting}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && matches) handleConfirm(); }}
                  placeholder={confirmText}
                  className={cn(
                    'w-full bg-white/[0.03] border rounded-xl px-3 py-2.5 text-sm font-mono outline-none transition-colors',
                    matches
                      ? 'border-red-500/40 text-red-300 focus:border-red-500/60'
                      : 'border-white/5 text-white focus:border-white/20',
                  )}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <footer className="relative flex items-center justify-end gap-2 p-6 border-t border-white/5 bg-zinc-950/40">
              <button
                onClick={onClose}
                disabled={submitting}
                type="button"
                className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white px-4 py-2.5 rounded-xl border border-white/5 hover:bg-white/[0.04] disabled:opacity-40 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={!matches || submitting}
                type="button"
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all',
                  matches && !submitting
                    ? 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20'
                    : 'bg-red-500/20 text-red-300/60 cursor-not-allowed',
                )}
              >
                {submitting && <Loader2 size={13} className="animate-spin" />}
                {confirmLabel}
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
