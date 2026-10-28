import * as React from 'react';
import { cn } from '../../lib/utils';
import { IconTile } from './primitives';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** CTA principal (ex.: <Button>Novo cliente</Button>). */
  action?: React.ReactNode;
  className?: string;
}

/** Estado vazio padrão: icon tile + título + descrição + CTA. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn('flex flex-col items-center justify-center gap-3 px-6 py-16 text-center', className)}
    >
      <IconTile icon={icon} />
      <h3 className="font-display text-lg font-black uppercase tracking-tight text-fg-1">{title}</h3>
      {description && <p className="max-w-sm text-sm text-fg-2">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
