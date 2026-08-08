export function normalizeXadTagIdentifier(input: string): string {
  const digits = String(input ?? '').replace(/\D/g, '');
  if (!digits) throw new Error('Informe o identificador da XADTAG.');
  if (digits.length > 15) throw new Error('O identificador não pode ultrapassar 15 dígitos.');
  return digits.padStart(15, '0');
}

export function originalXadTagIdentifier(input: string): string {
  const digits = String(input ?? '').replace(/\D/g, '');
  if (!digits) throw new Error('Informe o identificador da XADTAG.');
  if (digits.length > 15) throw new Error('O identificador não pode ultrapassar 15 dígitos.');
  return digits;
}

export function normalizeXadTagMacAddress(input?: string): string | null {
  const normalized = String(input ?? '').replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (!normalized) return null;
  if (normalized.length !== 12) throw new Error('O MAC Address deve possuir 12 caracteres hexadecimais.');
  return normalized.match(/.{2}/g)?.join(':') || normalized;
}

export function buildTraccarDeviceName(tenantSlug: string, imeiOriginal: string): string {
  const slug = String(tenantSlug ?? '').trim().toLowerCase();
  if (!slug || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) throw new Error('Slug do tenant inválido.');
  return `${slug}+${originalXadTagIdentifier(imeiOriginal)}`;
}
