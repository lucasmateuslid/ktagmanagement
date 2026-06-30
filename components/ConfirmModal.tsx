
import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Check, Info } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCancel?: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
}

const MotionDiv = motion.div as any;

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'danger'
}) => {
  const colors = {
    danger: 'text-red-500 bg-red-500/10 border-red-500/20 hover:bg-red-600',
    warning: 'text-amber-500 bg-amber-500/10 border-amber-500/20 hover:bg-amber-600',
    info: 'text-blue-500 bg-blue-500/10 border-blue-500/20 hover:bg-blue-600',
    success: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-600'
  };

  const icons = {
    danger: <AlertTriangle size={32} />,
    warning: <AlertTriangle size={32} />,
    info: <Info size={32} />,
    success: <Check size={32} />
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          
          <MotionDiv
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800"
          >
            <div className="p-8 text-center">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 border transition-all ${type === 'danger' ? 'text-red-500 bg-red-500/10 border-red-500/20' : type === 'warning' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' : type === 'success' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-blue-500 bg-blue-500/10 border-blue-500/20'}`}>
                {icons[type]}
              </div>
              
              <h3 className="text-xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight mb-2">
                {title}
              </h3>
              
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
                {message}
              </p>
            </div>
            
            <div className="flex border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => {
                  if (onCancel) onCancel();
                  else onClose();
                }}
                className="flex-1 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-r border-zinc-100 dark:border-zinc-800"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`flex-1 py-5 text-[10px] font-black uppercase tracking-widest text-white transition-all ${type === 'danger' ? 'bg-red-600 hover:bg-red-500' : type === 'warning' ? 'bg-amber-600 hover:bg-amber-500' : type === 'success' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-blue-600 hover:bg-blue-500'}`}
              >
                {confirmText}
              </button>
            </div>
          </MotionDiv>
        </div>
      )}
    </AnimatePresence>
  );
};
