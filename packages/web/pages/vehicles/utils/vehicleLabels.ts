import { Vehicle } from '../../../types';

/** Acima disso a última posição é considerada atrasada. */
export const STALE_POSITION_MS = 60 * 60 * 1000;

export const STATUS_LABEL: Record<NonNullable<Vehicle['status']>, string> = {
  active: 'Ativo',
  maintenance: 'Manutenção',
  stolen: 'Roubado',
};

export const STATUS_TONE: Record<NonNullable<Vehicle['status']>, 'emerald' | 'neutral' | 'red'> = {
  active: 'emerald',
  maintenance: 'neutral',
  stolen: 'red',
};

export const OWNERSHIP_LABEL: Record<NonNullable<Vehicle['ownershipStatus']>, string> = {
  leased: 'Comodato',
  purchased: 'Adquirido',
};

export function installationLabel(vehicle: Pick<Vehicle, 'tagId' | 'trackerId'>): string {
  if (vehicle.trackerId) return vehicle.tagId ? 'Tag e rastreador' : 'Somente rastreador';
  return vehicle.tagId ? 'Somente tag' : 'Nenhum equipamento';
}

/** Id usado pelo mapa (?tagId=) — tag ou rastreador. */
export function trackingIdOf(vehicle: Pick<Vehicle, 'tagId' | 'trackerId'>): string {
  return vehicle.tagId || (vehicle.trackerId ? `tracker:${vehicle.trackerId}` : '');
}

export function formatDateTime(timestamp?: number): string {
  if (!timestamp) return 'Sem registro';
  return new Date(timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
}

/** "há 5 min", "há 2 h", "há 3 d". */
export function timeAgo(timestamp: number, now = Date.now()): string {
  const minutes = Math.floor((now - timestamp) / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}
