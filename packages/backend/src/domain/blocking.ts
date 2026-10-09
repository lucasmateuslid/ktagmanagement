import type { TraccarPosition } from '@ktag/shared';

/** Traccar informa velocidade em nós; 3 km/h tolera pequena oscilação do GPS. */
export function isSafeToBlock(position: TraccarPosition | null, now = Date.now()): boolean {
  if (!position?.valid) return false;
  const age = now - Date.parse(position.fixTime || position.serverTime || '');
  return Number.isFinite(age) && age >= 0 && age <= 120_000
    && Number.isFinite(position.speed) && position.speed >= 0 && position.speed * 1.852 <= 3;
}
