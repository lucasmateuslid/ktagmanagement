import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

const MotionDiv = motion.div as any;

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';

const sizeMap: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  '2xl': 'max-w-3xl',
  '3xl': 'max-w-5xl',
  full: 'max-w-[min(95vw,1280px)]',
};

interface ResponsiveModalProps {
  open: boolean;
  onClose: () => void;
  /** Tamanho máximo em desktop. Em mobile sempre ocupa quase 100% (com mx-3). */
  size?: ModalSize;
  /** Conteúdo do cabeçalho (à esquerda do botão X). Se omitido, header é escondido. */
  title?: React.ReactNode;
  /** Subtítulo opcional abaixo do title. */
  subtitle?: React.ReactNode;
  /** Conteúdo do rodapé. Fica sticky no bottom em telas pequenas. */
  footer?: React.ReactNode;
  /** Conteúdo do corpo (scrollável). */
  children: React.ReactNode;
  /** Classe extra no painel. */
  className?: string;
  /** Classe extra no body (scroll container). */
  bodyClassName?: string;
  /** Fechar ao clicar fora. Default true. */
  closeOnBackdrop?: boolean;
  /** Mostrar botão X. Default true. */
  showClose?: boolean;
  /** Cor sutil de destaque no topo (ex.: red para destrutivo). */
  accent?: 'primary' | 'red' | 'emerald' | 'blue' | 'amber' | 'none';
  /** z-index override (default 'z-modal'). */
  zIndexClass?: string;
}

const accentClass = (a: ResponsiveModalProps['accent']) => {
  switch (a) {
    case 'red': return 'bg-red-500';
    case 'emerald': return 'bg-emerald-500';
    case 'blue': return 'bg-blue-500';
    case 'amber': return 'bg-amber-500';
    case 'primary': return 'bg-primary-500';
    default: return null;
  }
};

/**
 * Modal responsivo padronizado do app.
 * - Em mobile: ocupa quase a viewport inteira com mx-3 e max-h dinâmico.
 * - Em desktop: respeita `size` (sm..3xl, full).
 * - Header sticky, body com scroll, footer opcional sticky.
 * - Mantém identidade visual: rounded-[24px] sm:rounded-[32px], shadow-2xl, border zinc.
 */
export const ResponsiveModal: React.FC<ResponsiveModalProps> = ({
  open,
  onClose,
  size = 'xl',
  title,
  subtitle,
  footer,
  children,
  className,
  bodyClassName,
  closeOnBackdrop = true,
  showClose = true,
  accent = 'none',
  zIndexClass = 'z-modal',
}) => {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (typeof window === 'undefined') return null;

  const accentBar = accentClass(accent);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={cn('fixed inset-0 flex items-end sm:items-center justify-center p-2 sm:p-4', zIndexClass)}>
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => closeOnBackdrop && onClose()}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <MotionDiv
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={cn(
              'relative w-full bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800',
              'rounded-t-[24px] sm:rounded-[28px] md:rounded-[32px]',
              'flex flex-col overflow-hidden',
              'max-h-[calc(100svh-1rem)] sm:max-h-[calc(100vh-2rem)]',
              sizeMap[size],
              className,
            )}
          >
            {accentBar && <div className={cn('absolute top-0 left-0 right-0 h-1 sm:h-1.5', accentBar)} />}

            {(title || showClose) && (
              <div className="flex items-start justify-between gap-3 p-5 sm:p-6 md:p-7 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                <div className="flex-1 min-w-0 pr-2">
                  {title && (
                    <h3 className="text-base sm:text-lg md:text-xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-tight">
                      {title}
                    </h3>
                  )}
                  {subtitle && (
                    <div className="mt-1 text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-widest leading-snug">
                      {subtitle}
                    </div>
                  )}
                </div>
                {showClose && (
                  <button
                    onClick={onClose}
                    aria-label="Fechar"
                    className="shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            )}

            <div className={cn('flex-1 overflow-y-auto overscroll-contain custom-scrollbar', bodyClassName)}>
              {children}
            </div>

            {footer && (
              <div className="shrink-0 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 sm:px-6 md:px-7 py-4 pb-safe-or-6 sm:pb-4">
                {footer}
              </div>
            )}
          </MotionDiv>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

/**
 * Helper para conteúdo padrão (padding consistente).
 */
export const ModalSection: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div className={cn('p-5 sm:p-6 md:p-7', className)}>{children}</div>
);

/**
 * Helper para linha de botões no footer.
 * Em mobile fica em coluna; em sm+ vira linha alinhada à direita.
 */
export const ModalFooterActions: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3', className)}>
    {children}
  </div>
);
