import type { LiveMapTrackedAsset } from '@ktag/shared';
import type { LocationHistory, Tag } from '../../../types';
import { safeLocationAddress } from './livemapLocations';

/** Só associa telemetria Traccar a uma XADTAG identificada no tenant atual. */
export function traccarAssetLocation(asset: LiveMapTrackedAsset, tags: Tag[], tenantId: string): LocationHistory | null {
  if (asset.tenantId !== tenantId || !['traccar', 'ktag'].includes(asset.source)) return null;
  if (asset.equipmentType === 'K_TAG') {
    const tag = tags.find(item => item.type === 'K_TAG' && item.id === asset.equipmentId);
    const timestamp = Date.parse(asset.fixTime || asset.serverTime || '');
    if (!tag || !asset.linkedEntityId || !Number.isFinite(timestamp) || timestamp <= 0) return null;
    return { id: tag.id, tagId: tag.id, vehicleId: asset.linkedEntityId, provider: asset.source === 'traccar' ? 'traccar' : 'ktag',
      lat: asset.latitude, lon: asset.longitude, timestamp, isodatetime: new Date(timestamp).toISOString(),
      conf: asset.valid ? 100 : 0, status: asset.status === 'online' ? 1 : 0,
      speed: asset.speed, course: asset.course, altitude: asset.altitude,
      address: asset.source === 'ktag' && !asset.addressResolutionProvider ? undefined
        : safeLocationAddress(asset.address, asset.addressResolutionProvider, asset.addressVerifiedAt) };
  }
  if (asset.equipmentType === 'TRACKER') {
    const timestamp = Date.parse(asset.fixTime || asset.serverTime || '');
    if (!asset.equipmentId || !asset.linkedEntityId || !Number.isFinite(timestamp) || timestamp <= 0) return null;
    return { id: `tracker:${asset.equipmentId}`, tagId: `tracker:${asset.equipmentId}`, vehicleId: asset.linkedEntityId,
      provider: 'traccar', lat: asset.latitude, lon: asset.longitude, timestamp, isodatetime: new Date(timestamp).toISOString(),
      conf: asset.valid ? 100 : 0, status: asset.status === 'online' ? 1 : 0, speed: asset.speed, course: asset.course,
      altitude: asset.altitude, address: safeLocationAddress(asset.address, asset.addressResolutionProvider, asset.addressVerifiedAt) };
  }
  if (asset.equipmentType !== 'XADTAG') return null;
  const candidates = tags.filter(tag => tag.type === 'XADTAG' && (
    asset.equipmentId
      ? tag.id === asset.equipmentId
      : Boolean(asset.uniqueId && (tag.traccarUniqueId === asset.uniqueId || tag.identifierNormalized === asset.uniqueId))
        || Boolean(tag.identifierNormalized && asset.id === `xadtag_${tag.identifierNormalized}`)
  ));
  if (candidates.length !== 1) return null;
  const tag = candidates[0];
  const timestamp = Date.parse(asset.fixTime || asset.serverTime || '');
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  const level = asset.attributes?.batteryLevel;
  const batteryLevel = typeof level === 'number' && Number.isFinite(level) ? Math.max(0, Math.min(100, level)) : null;
  return {
    id: tag.id, tagId: tag.id, provider: 'traccar',
    ...(asset.linkedEntityId ? { vehicleId: asset.linkedEntityId } : {}),
    lat: asset.latitude, lon: asset.longitude, timestamp, isodatetime: new Date(timestamp).toISOString(),
    conf: asset.valid ? 100 : 0, status: asset.status === 'online' ? 1 : 0,
    address: safeLocationAddress(asset.address, asset.addressResolutionProvider, asset.addressVerifiedAt),
    ...(batteryLevel === null ? {} : { battery: { level: batteryLevel, label: `${Math.round(batteryLevel)}%`, color: batteryLevel > 25 ? '#10b981' : '#ef4444' } }),
  };
}
