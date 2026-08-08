import type { LiveMapTrackedAsset, TraccarDevice, TraccarPosition, TrackedPosition, XadTag } from '@ktag/shared';
import { getTraccarConfig } from '../config/traccar.js';
import { buildTraccarDeviceName, normalizeXadTagIdentifier, normalizeXadTagMacAddress, originalXadTagIdentifier } from '../domain/xadtag.js';
import { XadTagConflictError, xadTagRepository } from '../repositories/xadtagRepository.js';
import { addressResolver } from './addressResolver.js';
import { traccarClient, TraccarHttpError } from './traccarClient.js';

const positionCache = new Map<number, { expiresAt: number; value: TrackedPosition }>();
export const toTrackedPosition = (position: TraccarPosition, address?: string | null): TrackedPosition => ({
  id: position.id, deviceId: position.deviceId, latitude: position.latitude, longitude: position.longitude,
  altitude: position.altitude, speed: position.speed, course: position.course,
  accuracy: typeof position.attributes?.accuracy === 'number' ? position.attributes.accuracy : undefined,
  valid: position.valid, address: address ?? position.address ?? null, deviceTime: position.deviceTime,
  fixTime: position.fixTime, serverTime: position.serverTime, attributes: position.attributes,
});

export function communicationStatus(device: TraccarDevice): XadTag['traccarStatus'] {
  if (device.status === 'online') return 'online';
  if (!device.lastUpdate) return device.status || 'unknown';
  return Date.now() - Date.parse(device.lastUpdate) < 5 * 60_000 ? 'delayed' : 'offline';
}

export class XadTagService {
  async register(tenantId: string, tenantSlug: string, imei: string, macAddress?: string, description?: string) {
    const imeiOriginal = originalXadTagIdentifier(imei);
    const identifierNormalized = normalizeXadTagIdentifier(imei);
    const normalizedMacAddress = normalizeXadTagMacAddress(macAddress);
    // O Traccar usa o IMEI real como uniqueId. Consulte antes de tentar criar.
    let device = await traccarClient.findDeviceByUniqueId(imeiOriginal);
    if (!device && identifierNormalized !== imeiOriginal) device = await traccarClient.findDeviceByUniqueId(identifierNormalized);
    await xadTagRepository.assertAvailable(tenantId, identifierNormalized);
    const known = await xadTagRepository.findByIdentifier(tenantId, identifierNormalized);
    if (known) {
      const updates: Partial<XadTag> = {};
      if (!known.imei) updates.imei = imeiOriginal;
      if (!known.macAddress && normalizedMacAddress) updates.macAddress = normalizedMacAddress;
      if (Object.keys(updates).length > 0) await xadTagRepository.update(tenantId, known.id, updates);
      return { item: { ...known, ...updates }, created: false, externalCreated: false };
    }
    let externalCreated = false;
    if (!device) {
      try {
        device = await traccarClient.createDevice({
          name: buildTraccarDeviceName(tenantSlug, imeiOriginal), uniqueId: imeiOriginal, disabled: false,
          model: 'XADTAG', category: 'XADTAG', attributes: { equipmentType: 'XADTAG', tenantSlug, platformSource: getTraccarConfig().platformSource, usesSimCard: false, imei: imeiOriginal, ...(normalizedMacAddress ? { macAddress: normalizedMacAddress } : {}) },
        });
        externalCreated = true;
      } catch (error) {
        if (error instanceof TraccarHttpError && error.status === 400) device = await traccarClient.findDeviceByUniqueId(identifierNormalized);
        if (!device) throw error;
      }
    }
    const externalTenant = typeof device.attributes?.tenantSlug === 'string' ? device.attributes.tenantSlug : null;
    if (externalTenant && externalTenant !== tenantSlug) throw new XadTagConflictError('Esta XADTAG já está vinculada a outra empresa.');
    const desiredAttributes = { ...(device.attributes || {}), equipmentType: 'XADTAG', tenantSlug, platformSource: getTraccarConfig().platformSource, usesSimCard: false, imei: imeiOriginal, ...(normalizedMacAddress ? { macAddress: normalizedMacAddress } : {}) };
    if (!externalCreated && (device.attributes?.imei !== imeiOriginal || (normalizedMacAddress && device.attributes?.macAddress !== normalizedMacAddress))) {
      await traccarClient.updateDevice(device.id, { ...device, attributes: desiredAttributes });
      device = await traccarClient.getDevice(device.id);
    }
    const now = Date.now();
    const result = await xadTagRepository.reserveAndCreate({
      tenantId, name: description?.trim() || `XADTAG ${imeiOriginal}`, type: 'XADTAG', accessoryId: identifierNormalized,
      equipmentType: 'XADTAG', model: 'XADTAG', imei: imeiOriginal, imeiOriginal, macAddress: normalizedMacAddress, identifierNormalized,
      protocol: 'gt06', traccarPort: getTraccarConfig().gt06Port, usesSimCard: false, trackingProvider: 'traccar',
      traccarDeviceId: device.id, traccarDeviceName: device.name, traccarPositionId: device.positionId ?? null,
      traccarStatus: communicationStatus(device), integrationStatus: 'linked', description,
      lastIntegrationCheckAt: now, createdAt: now, updatedAt: now,
    });
    console.info(JSON.stringify({ event: externalCreated ? 'traccar.device.created' : 'traccar.device.reused', tenantId, equipmentId: result.item.id, uniqueId: identifierNormalized, traccarDeviceId: device.id }));
    return { ...result, externalCreated };
  }

  async check(item: XadTag) {
    const device = await traccarClient.getDevice(item.traccarDeviceId);
    const raw = device.positionId ? await traccarClient.getPositionById(device.positionId) : null;
    const position = raw ? await this.resolvePosition(raw) : null;
    await xadTagRepository.update(item.tenantId, item.id, { traccarStatus: communicationStatus(device), traccarPositionId: device.positionId ?? null, integrationStatus: 'linked', lastIntegrationCheckAt: Date.now(), ...(position ? { lastPosition: position } : {}) });
    return { found: true, status: communicationStatus(device), lastUpdate: device.lastUpdate ?? null, hasPosition: Boolean(position), position };
  }
  async resolvePosition(raw: TraccarPosition) {
    const cached = positionCache.get(raw.deviceId);
    if (cached && cached.value.id === raw.id && cached.expiresAt > Date.now()) return cached.value;
    const address = await addressResolver.resolve(raw);
    const value = { ...toTrackedPosition(raw, address.address), addressResolutionStatus: address.status, addressResolutionAttempts: address.attempts };
    positionCache.set(raw.deviceId, { value, expiresAt: Date.now() + getTraccarConfig().positionCacheTtlMs });
    return value;
  }
  toLiveMap(item: XadTag): LiveMapTrackedAsset | null {
    if (!item.linkedEntityId || !item.lastPosition) return null;
    return { ...item.lastPosition, id: `xadtag_${item.identifierNormalized}`, source: 'traccar', equipmentType: 'XADTAG', tenantId: item.tenantId,
      imei: item.imeiOriginal, uniqueId: item.identifierNormalized, traccarDeviceId: item.traccarDeviceId,
      linkedEntityId: item.linkedEntityId, linkedEntityName: item.linkedEntityName, status: item.traccarStatus, lastUpdate: item.lastPosition.serverTime };
  }
}
export const xadTagService = new XadTagService();
