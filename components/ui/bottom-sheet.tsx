import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion';
import { cn } from '../../lib/utils';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  /** Altura máxima do sheet, padrão 85vh. */
  maxHeight?: string;
  /** Se true, fecha ao tocar fora. */
  closeOnOverlay?: boolean;
  /** Se true, exibe handle e habilita swipe-to-dismiss. */
  draggable?: boolean;
  className?: string;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  maxHeight = '85vh',
  closeOnOverlay = true,
  draggable = true,
  className,
}: BottomSheetProps) {
  const dragControls = useDragControls();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) onClose();
  };

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onMouseDown={() => closeOnOverlay && onClose()}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            drag={draggable ? 'y' : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.3 }}
            onDragEnd={handleDragEnd}
            style={{ maxHeight }}
            className={cn(
              'relative w-full sm:w-[480px] bg-zinc-950/95 backdrop-blur-xl border border-white/10',
              'rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-black/50 overflow-hidden',
              'flex flex-col',
              className,
            )}
          >
            {draggable && (
              <div
                className="pt-2 pb-1 flex justify-center cursor-grab active:cursor-grabbing touch-none"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="w-10 h-1 rounded-full bg-white/15" />
              </div>
            )}

            {title && (
              <header
                className={cn(
                  'flex items-center justify-between gap-3 px-5 py-3 border-b border-white/5',
                  draggable && 'cursor-grab active:cursor-grabbing touch-none',
                )}
                onPointerDown={(e) => draggable && dragControls.start(e)}
              >
                <div className="font-display font-black text-sm uppercase tracking-widest text-white">
                  {title}
                </div>
              </header>
            )}

            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
