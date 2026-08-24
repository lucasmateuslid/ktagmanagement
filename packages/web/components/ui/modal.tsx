import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Modal — primitiva acessível sobre @radix-ui/react-dialog.
 *
 * Padroniza overlay, animação, focus trap, esc-to-close, role=dialog,
 * aria-modal e z-index (theme.zIndex.modal = 2000).
 *
 * Uso:
 *   <Modal open={isOpen} onOpenChange={setOpen} title="Confirmar">
 *     <p>Conteúdo</p>
 *     <Modal.Footer>
 *       <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
 *       <Button onClick={confirm}>Confirmar</Button>
 *     </Modal.Footer>
 *   </Modal>
 */

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const SIZE: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-[min(95vw,1200px)]',
};

const MotionDiv = motion.div as any;

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cabeçalho (string ou node). Vira <Dialog.Title> = a11y label */
  title?: React.ReactNode;
  /** Subtítulo opcional sob o título */
  description?: React.ReactNode;
  size?: ModalSize;
  /** Esconde o X. Mantém ESC e click no overlay. */
  hideCloseButton?: boolean;
  /** Desativa fechar ao clicar fora */
  disableOverlayClose?: boolean;
  /** Classes extras no container do conteúdo */
  className?: string;
  children: React.ReactNode;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  hideCloseButton,
  disableOverlayClose,
  className,
  children,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <MotionDiv
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-overlay bg-black/70 backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              onPointerDownOutside={(e) => {
                if (disableOverlayClose) e.preventDefault();
              }}
              onEscapeKeyDown={(e) => {
                if (disableOverlayClose) e.preventDefault();
              }}
            >
              <MotionDiv
                // Não animar transform aqui: Framer sobrescreve o translate
                // CSS (-50%, -50%) responsável por centralizar no desktop.
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  /* Mobile (default): bottom sheet — sobe do fundo, encosta nas bordas */
                  'fixed z-modal',
                  'inset-x-0 bottom-0 w-full max-w-full',
                  'rounded-t-card rounded-b-none',
                  /* sm+ : modal centralizado tradicional */
                  'sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto',
                  'sm:-translate-x-1/2 sm:-translate-y-1/2',
                  'sm:w-[calc(100vw-2rem)] sm:rounded-card',
                  SIZE[size],
                  /* Casca visual */
                  'bg-surface-raised border border-border shadow-modal',
                  /* Altura mobile: ocupa até 92dvh; desktop: até 100vh - 2rem */
                  'max-h-[92dvh] sm:max-h-[calc(100vh-2rem)]',
                  'overflow-hidden flex flex-col',
                  className,
                )}
              >
                {(title || !hideCloseButton) && (
                  <div className="flex items-start justify-between gap-4 p-6 pb-4 border-b border-border">
                    <div className="min-w-0 flex-1">
                      {title && (
                        <Dialog.Title className="font-display text-lg font-black text-content uppercase tracking-tight truncate">
                          {title}
                        </Dialog.Title>
                      )}
                      {description && (
                        <Dialog.Description className="mt-1 text-sm text-content-muted">
                          {description}
                        </Dialog.Description>
                      )}
                    </div>
                    {!hideCloseButton && (
                      <Dialog.Close
                        aria-label="Fechar"
                        className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-lg text-content-muted hover:bg-surface-sunken hover:text-content transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
                      >
                        <X size={16} />
                      </Dialog.Close>
                    )}
                  </div>
                )}
                <div className="overflow-y-auto p-6">{children}</div>
              </MotionDiv>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

Modal.Footer = function ModalFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        '-mx-6 -mb-6 mt-6 px-6 py-4 border-t border-border bg-surface-sunken/40 flex items-center justify-end gap-3',
        className,
      )}
    >
      {children}
    </div>
  );
};
