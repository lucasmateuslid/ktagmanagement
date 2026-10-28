import * as React from 'react';
import { SearchX } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { PageContainer } from './page-container';
import { RecordHeader } from './record';

interface FormPageProps {
  /** Micro-label de contexto (ex.: "Ficha do veículo"). */
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  backLabel: string;
  /** Voltar / fechar (sem salvar). */
  onBack: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  /** Rodapé fixo (use <StickyFormFooter/>). */
  footer: React.ReactNode;
  /** Seções lado a lado em telas largas (default true). */
  columns?: boolean;
  children: React.ReactNode;
}

/** Página dedicada de cadastro/edição: cabeçalho de ficha + <form> em colunas + rodapé fixo. */
export function FormPage({
  eyebrow, title, subtitle, icon, backLabel, onBack, onSubmit, footer, columns = true, children,
}: FormPageProps) {
  return (
    <PageContainer size="full" withBottomNav className="space-y-6">
      <RecordHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        icon={icon}
        backLabel={backLabel}
        onBack={onBack}
        onClose={onBack}
        divider
      />
      <form
        onSubmit={onSubmit}
        noValidate
        className={cn('grid grid-cols-1 items-start gap-6 pb-24', columns && 'xl:grid-cols-2')}
      >
        {children}
        {footer}
      </form>
    </PageContainer>
  );
}

/** Seção do formulário: card (raio 24) com título, descrição e grade de campos. */
export function FormSection({
  title,
  description,
  aside,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-black tracking-tight text-fg-1">{title}</h2>
          {description && <p className="mt-1 text-caption text-fg-2">{description}</p>}
        </div>
        {aside}
      </div>
      <div className="mt-5 grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Rodapé fixo com Cancelar + Salvar. */
export function StickyFormFooter({
  onCancel,
  isSaving,
  submitLabel = 'Salvar',
  savingLabel = 'Salvando…',
  disabled,
}: {
  onCancel: () => void;
  isSaving?: boolean;
  submitLabel?: string;
  savingLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-sticky border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md sm:px-8 lg:left-72">
      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving || disabled} aria-busy={isSaving} className="min-w-40">
          {isSaving ? savingLabel : submitLabel}
        </Button>
      </div>
    </div>
  );
}

/** Registro inexistente (id inválido em /:id/edit). */
export function NotFoundState({ what, onBack }: { what: string; onBack: () => void }) {
  return (
    <PageContainer size="5xl">
      <EmptyState
        icon={<SearchX size={22} aria-hidden />}
        title={`${what} não encontrado`}
        description="O registro pode ter sido removido ou o link está incorreto."
        action={<Button onClick={onBack}>Voltar à lista</Button>}
      />
    </PageContainer>
  );
}
