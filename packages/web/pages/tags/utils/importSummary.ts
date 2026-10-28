export interface ImportCommitSummary {
  created: number;
  existing: number;
  pending: number;
  invalid: number;
  unavailable: number;
}

export interface ImportRowResult {
  index: number;
  status: string;
  error?: string;
}

export type ImportTone = 'success' | 'warning' | 'error';

export interface ImportOutcome {
  tone: ImportTone;
  title: string;
  message: string;
}

export function summarizeImport(summary: ImportCommitSummary, label: string): ImportOutcome {
  const failed = summary.invalid + summary.unavailable;
  const message = `${summary.created} criadas, ${summary.existing} já existentes, ${summary.pending} pendentes no Traccar, ${failed} com erro.`;
  if (summary.created === 0 && summary.existing === 0 && summary.pending === 0) {
    return { tone: 'error', title: `Nenhuma ${label} importada`, message };
  }
  if (failed > 0 || summary.pending > 0 || summary.created === 0) {
    return { tone: 'warning', title: `Importação ${label} parcial`, message };
  }
  return { tone: 'success', title: `Importação ${label} concluída`, message };
}

export function rowStatusLabel(status: string): string {
  return ({
    created: 'Criada',
    existing: 'Já existente',
    pending: 'Pendente no Traccar',
    unavailable: 'Indisponível',
    invalid: 'Inválida',
  } as Record<string, string>)[status] || status;
}
