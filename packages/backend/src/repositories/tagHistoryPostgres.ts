import { postgres } from '../services/postgres.js';

export type TagHistoryMode = 'firestore' | 'dual' | 'postgres';

export function tagHistoryMode(): TagHistoryMode {
  const mode = process.env.TAG_HISTORY_STORE || 'firestore';
  if (mode !== 'firestore' && mode !== 'dual' && mode !== 'postgres') throw new Error(`TAG_HISTORY_STORE inválido: ${mode}`);
  return mode;
}

type HistoryPoint = Record<string, unknown> & { tagId: string; timestamp: number; lat: number; lon: number };

export async function upsertTagHistory(tenantId: string, id: string, point: HistoryPoint): Promise<void> {
  await postgres().query(
    `INSERT INTO tag_history (tenant_id, id, tag_id, vehicle_id, captured_at, latitude, longitude, payload)
     VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0), $6, $7, $8::jsonb)
     ON CONFLICT (tenant_id, id) DO UPDATE SET
       payload = tag_history.payload || jsonb_strip_nulls(EXCLUDED.payload),
       vehicle_id = COALESCE(EXCLUDED.vehicle_id, tag_history.vehicle_id)`,
    [tenantId, id, point.tagId, point.vehicleIdAtCapture || point.vehicleId || null, point.timestamp,
      point.lat, point.lon, JSON.stringify(point)],
  );
}

export async function updateTagHistoryAddress(
  tenantId: string, id: string, lat: number, lon: number, address: Record<string, unknown>,
): Promise<void> {
  await postgres().query(
    `UPDATE tag_history SET payload = payload || $5::jsonb
     WHERE tenant_id = $1 AND id = $2 AND latitude = $3 AND longitude = $4`,
    [tenantId, id, lat, lon, JSON.stringify(address)],
  );
}

export async function loadTagHistory(
  tenantId: string, tagId: string, from: number, to: number, limit: number,
  cursor?: { timestamp: number; id: string } | null,
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const result = await postgres().query<{ id: string; payload: Record<string, unknown> }>(
    `SELECT id, payload FROM tag_history
     WHERE tenant_id = $1 AND tag_id = $2
       AND captured_at >= to_timestamp($3 / 1000.0)
       AND captured_at <= to_timestamp($4 / 1000.0)
       AND ($5::double precision IS NULL OR (captured_at, id) < (to_timestamp($5 / 1000.0), $6::text))
     ORDER BY captured_at DESC, id DESC LIMIT $7`,
    [tenantId, tagId, from, to, cursor?.timestamp ?? null, cursor?.id?.replace(/^ktag:/, '') ?? null, limit],
  );
  return result.rows.map(row => ({ id: row.id, data: row.payload }));
}

export async function purgeTagHistory(cutoff: number): Promise<number> {
  const result = await postgres().query('DELETE FROM tag_history WHERE saved_at < to_timestamp($1 / 1000.0)', [cutoff]);
  return result.rowCount || 0;
}
