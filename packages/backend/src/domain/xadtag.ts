import { normalizeEquipmentIdentifier, normalizeMac, type NormalizedEquipmentIdentifier } from '@ktag/shared';

export function normalizeXadTagIdentity(input: string): NormalizedEquipmentIdentifier {
  const value = String(input ?? '');
  if (!value) throw new Error('Informe o identificador da XADTAG.');
  if (!/^\d+$/.test(value)) throw new Error('O identificador deve conter somente dígitos.');
  if (/^\d{10}$/.test(value)) {
    return normalizeEquipmentIdentifier('numeric_serial', value, 'xadtag_legacy_numeric_10_to_15');
  }
  // Aceita o formato serial já normalizado para facilitar migrações/importações.
  if (/^0{5}\d{10}$/.test(value)) {
    return normalizeEquipmentIdentifier('numeric_serial', value.slice(5), 'xadtag_legacy_numeric_10_to_15');
  }
  if (/^\d{15}$/.test(value)) return normalizeEquipmentIdentifier('imei', value);
  throw new Error('O identificador deve conter um serial de 10 dígitos ou um IMEI de 15 dígitos.');
}

export function normalizeXadTagIdentifier(input: string): string {
  return normalizeXadTagIdentity(input).normalized;
}

export function originalXadTagIdentifier(input: string): string {
  return normalizeXadTagIdentity(input).original;
}

export function normalizeXadTagMacAddress(input?: string): string | null {
  if (!String(input ?? '')) return null;
  return normalizeMac(input);
}

export function buildTraccarDeviceName(tenantSlug: string, identifier: string): string {
  const slug = String(tenantSlug ?? '').trim().toLowerCase();
  if (!slug || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) throw new Error('Slug do tenant inválido.');
  return `${slug}+${normalizeXadTagIdentity(identifier).original}`;
}
