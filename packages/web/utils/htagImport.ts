import { isValidLuhn } from '@ktag/shared';

/** Modelo de importação H-TAG (aba "Template Importacao", colunas nome | imei). */
export const HTAG_IMPORT_SHEET = 'Template Importacao';
export const HTAG_IMPORT_FILE = 'modelo_importacao_h_tag.xlsx';
export const HTAG_IMPORT_TEMPLATE = [{ nome: 'H-TAG 01', imei: '123456789012345' }];

export interface HtagImportRow {
  name: string;
  imei: string;
  valid: boolean;
  error?: string;
}

const cell = (row: Record<string, unknown>, key: string): string => {
  const match = Object.keys(row).find(column => column.trim().toLowerCase() === key);
  return match === undefined ? '' : String(row[match] ?? '').trim();
};

export function validateHtagImei(raw: string): string | null {
  if (!raw) return 'IMEI não informado.';
  if (/e\+/i.test(raw)) return 'IMEI em notação científica; formate a coluna como texto.';
  if (!/^\d+$/.test(raw)) return 'IMEI deve conter somente dígitos.';
  if (raw.length !== 15) return 'IMEI deve conter exatamente 15 dígitos.';
  if (!isValidLuhn(raw)) return 'IMEI inválido (dígito verificador).';
  return null;
}

export function parseHtagImportRows(rows: Record<string, unknown>[]): HtagImportRow[] {
  const seen = new Set<string>();
  return rows.map(row => {
    const imei = cell(row, 'imei').replace(/\s+/g, '');
    const name = cell(row, 'nome') || cell(row, 'name');
    let error = validateHtagImei(imei);
    if (!error && seen.has(imei)) error = 'IMEI duplicado na planilha.';
    if (!error) seen.add(imei);
    return { name, imei, valid: !error, ...(error ? { error } : {}) };
  });
}
