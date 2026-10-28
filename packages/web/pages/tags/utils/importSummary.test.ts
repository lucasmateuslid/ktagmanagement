import { describe, expect, it } from 'vitest';
import { summarizeImport } from './importSummary';

const base = { created: 0, existing: 0, pending: 0, invalid: 0, unavailable: 0 };

describe('summarizeImport', () => {
  it('só marca sucesso quando criou e não há falhas', () => {
    expect(summarizeImport({ ...base, created: 3 }, 'H-TAG').tone).toBe('success');
  });
  it('marca erro quando nada foi criado', () => {
    expect(summarizeImport({ ...base, invalid: 2 }, 'H-TAG').tone).toBe('error');
  });
  it('marca aviso em resultado parcial ou pendente', () => {
    expect(summarizeImport({ ...base, created: 1, invalid: 1 }, 'H-TAG').tone).toBe('warning');
    expect(summarizeImport({ ...base, pending: 2 }, 'H-TAG').tone).toBe('warning');
  });
});
