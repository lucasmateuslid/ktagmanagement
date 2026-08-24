import { normalizeEquipmentIdentifier, normalizeMac } from '@ktag/shared';

export function normalizeXadTagIdentifier(input: string): string {
  return normalizeEquipmentIdentifier('numeric_serial', originalXadTagIdentifier(input), 'xadtag_legacy_numeric_10_to_15').normalized;
}

export function originalXadTagIdentifier(input: string): string {
  const value = String(input ?? '');
  if (!value) throw new Error('Informe o identificador da XADTAG.');
  if (!/^\d+$/.test(value)) throw new Error('O identificador deve conter somente dígitos.');
  if (/^\d{10}$/.test(value)) return value;
  if (/^0{5}\d{10}$/.test(value)) return value.slice(5);
  if (value.length === 15) throw new Error('O identificador de 15 dígitos deve começar com cinco zeros.');
  throw new Error('O identificador deve conter 10 dígitos ou 15 dígitos iniciados por 00000.');
}

export function normalizeXadTagMacAddress(input?: string): string | null {
  if (!String(input ?? '')) return null;
  return normalizeMac(input);
}

export function buildTraccarDeviceName(tenantSlug: string, imeiOriginal: string): string {
  const slug = String(tenantSlug ?? '').trim().toLowerCase();
  if (!slug || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) throw new Error('Slug do tenant inválido.');
  return `${slug}+${originalXadTagIdentifier(imeiOriginal)}`;
}
