import { normalizeKtagSnapshot } from './ktagHistoryCapture.js';

export type KtagKeyedItem = { hashedAdvKey: string };

export const normalizeKtagSerial = (value: unknown) => String(value || '').trim();

/** Chaves duplicadas não identificam um equipamento de forma inequívoca. */
export function duplicateKtagKeys(items: KtagKeyedItem[]) {
  const seen = new Set<string>(); const duplicates = new Set<string>();
  for (const item of items) {
    if (seen.has(item.hashedAdvKey)) duplicates.add(item.hashedAdvKey);
    seen.add(item.hashedAdvKey);
  }
  return duplicates;
}

/** Associa pela chave e escolhe a posição válida mais recente, independentemente da ordem. */
export function pairKtagResults<T extends KtagKeyedItem>(items: T[], results: Array<Record<string, unknown>>) {
  const duplicates = duplicateKtagKeys(items);
  const byKey = new Map(items.filter(item => !duplicates.has(item.hashedAdvKey)).map(item => [item.hashedAdvKey, item]));
  const latest = new Map<string, { item: T; raw: Record<string, unknown>; timestamp: number }>();
  const fallbackKey = items.length === 1 ? items[0].hashedAdvKey : '';
  for (const raw of results) {
    if (!raw) continue;
    const key = String(raw.key || fallbackKey); const item = byKey.get(key);
    const point = normalizeKtagSnapshot(raw);
    if (!item || !point) continue;
    if (!latest.has(key) || point.timestamp > latest.get(key)!.timestamp) latest.set(key, { item, raw, timestamp: point.timestamp });
  }
  return [...latest.values()].map(({ item, raw }) => ({ item, raw }));
}
