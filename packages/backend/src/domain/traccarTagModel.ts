import { isTraccarTagModel, normalizeEquipmentIdentifier, TRACCAR_TAG_LABELS, type NormalizedEquipmentIdentifier, type TraccarTagModel } from '@ktag/shared';
import { getTraccarConfig } from '../config/traccar.js';
import { normalizeXadTagIdentity } from './xadtag.js';

export interface TraccarTagProfile {
  model: TraccarTagModel;
  label: string;
  protocol: 'gt06' | 'easytrack';
  port: () => number;
  usesSimCard: boolean;
  normalizeIdentity: (input: string) => NormalizedEquipmentIdentifier;
}

export function normalizeHTagIdentity(input: string): NormalizedEquipmentIdentifier {
  const value = String(input ?? '');
  if (!value) throw new Error('Informe o IMEI da H-TAG.');
  return normalizeEquipmentIdentifier('imei', value);
}

// XADTAG (GT06) e H-TAG (E3+, protocolo easytrack) compartilham o mesmo pipeline
// Traccar; só mudam protocolo, porta e regra de identificador.
export const TRACCAR_TAG_PROFILES: Record<TraccarTagModel, TraccarTagProfile> = {
  XADTAG: { model: 'XADTAG', label: TRACCAR_TAG_LABELS.XADTAG, protocol: 'gt06', port: () => getTraccarConfig().gt06Port, usesSimCard: false, normalizeIdentity: normalizeXadTagIdentity },
  H_TAG: { model: 'H_TAG', label: TRACCAR_TAG_LABELS.H_TAG, protocol: 'easytrack', port: () => getTraccarConfig().easytrackPort, usesSimCard: true, normalizeIdentity: normalizeHTagIdentity },
};

export function parseTraccarTagModel(value: unknown): TraccarTagModel {
  if (value === undefined || value === null || value === '') return 'XADTAG';
  if (!isTraccarTagModel(value)) throw new Error('Modelo de tag Traccar inválido.');
  return value;
}

export function traccarTagProfile(model: unknown): TraccarTagProfile {
  return TRACCAR_TAG_PROFILES[parseTraccarTagModel(model)];
}

export function buildTraccarTagDeviceName(model: TraccarTagModel, tenantSlug: string, identifier: string): string {
  const slug = String(tenantSlug ?? '').trim().toLowerCase();
  if (!slug || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) throw new Error('Slug do tenant inválido.');
  return `${slug}+${TRACCAR_TAG_PROFILES[model].normalizeIdentity(identifier).original}`;
}
