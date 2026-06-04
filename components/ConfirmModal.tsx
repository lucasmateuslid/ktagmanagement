import * as React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Modal } from './ui/modal';
import { Button } from './ui/button';

/**
 * Modal de confirmação genérico — agora sobre <Modal> (Radix Dialog).
 * Mantém a API original para que call sites existentes não quebrem.
 */
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

const TONE = {
  danger:  { icon: AlertTriangle, accent: 'text-danger bg-danger/10 border-danger/20', btn: 'danger' as const },
  warning: { icon: AlertTriangle, accent: 'text-warning bg-warning/10 border-warning/20', btn: 'primary' as const },
  info:    { icon: Info,          accent: 'text-info bg-info/10 border-info/20',          btn: 'primary' as const },
};

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
  const t = TONE[type];
  const Icon = t.icon;

  return (
    <Modal open={isOpen} onOpenChange={(v) => !v && onClose()} size="sm" hideCloseButton>
      <div className="text-center -m-6 p-8">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 border ${t.accent}`}>
          <Icon size={32} aria-hidden />
        </div>
        <h3 className="font-display text-xl font-black text-content uppercase tracking-tight mb-2">
          {title}
        </h3>
        <p className="text-sm text-content-muted font-medium leading-relaxed">
          {message}
        </p>
      </div>
      <Modal.Footer className="grid grid-cols-2 gap-0 p-0 bg-transparent border-t border-border">
        <button
          onClick={onClose}
          className="py-5 text-label-xs uppercase text-content-muted hover:bg-surface-sunken transition-colors border-r border-border focus-visible:outline-none focus-visible:bg-surface-sunken"
        >
          {cancelText}
        </button>
        <Button
          variant={t.btn}
          size="lg"
          onClick={() => { onConfirm(); onClose(); }}
          className="rounded-none h-auto py-5 shadow-none"
        >
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
