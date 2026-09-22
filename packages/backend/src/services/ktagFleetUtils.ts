export type KtagKeyedItem = { hashedAdvKey: string };

export const normalizeKtagSerial = (value: unknown) => String(value || '').trim();

/** Preserva a ordem quando o provedor devolve a mesma chave mais de uma vez. */
export function pairKtagResults<T extends KtagKeyedItem>(items: T[], results: Array<Record<string, unknown>>) {
  const queues = new Map<string, T[]>();
  for (const item of items) {
    const queue = queues.get(item.hashedAdvKey) || [];
    queue.push(item); queues.set(item.hashedAdvKey, queue);
  }
  const fallbackKey = items.length === 1 ? items[0].hashedAdvKey : '';
  return results.flatMap(raw => {
    const key = String(raw.key || fallbackKey); const item = queues.get(key)?.shift();
    return item ? [{ item, raw }] : [];
  });
}
