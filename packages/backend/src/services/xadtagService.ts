import { normalizeEquipmentIdentifier, type EquipmentIdentifierKind, type EquipmentIdentifierProfile, type LiveMapTrackedAsset, type TraccarDevice, type TraccarPosition, type TrackedPosition, type XadTag } from '@ktag/shared';
import { getTraccarConfig } from '../config/traccar.js';
import { buildTraccarDeviceName, originalXadTagIdentifier } from '../domain/xadtag.js';
import { communicationStatus } from '../domain/communicationStatus.js';
import { XadTagConflictError, xadTagRepository } from '../repositories/xadtagRepository.js';
import { addressResolver } from './addressResolver.js';
import { traccarClient, TraccarHttpError } from './traccarClient.js';

const positionCache = new Map<number, { expiresAt: number; value: TrackedPosition }>();
const stripUndefined = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(stripUndefined) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .map(([key, child]) => [key, stripUndefined(child)])) as T;
  }
  return value;
};
export const toTrackedPosition = (position: TraccarPosition, address?: string | null): TrackedPosition => stripUndefined({
  id: position.id, deviceId: position.deviceId, latitude: position.latitude, longitude: position.longitude,
  altitude: position.altitude, speed: position.speed, course: position.course,
  accuracy: typeof position.attributes?.accuracy === 'number' ? position.attributes.accuracy : undefined,
  valid: position.valid, address: address ?? position.address ?? null, deviceTime: position.deviceTime,
  fixTime: position.fixTime, serverTime: position.serverTime, attributes: position.attributes,
});

export class XadTagService {
  async register(input: { tenantId: string; tenantSlug: string; name: string; identifierKind: EquipmentIdentifierKind; identifierOriginal: string; traccarUniqueId: string; identifierProfile?: EquipmentIdentifierProfile; requestId?: string; traqcareId?: string; powerType?: 'battery' | '12v'; batteryWarrantyYears?: number }) {
    const { tenantId, tenantSlug } = input;
    if (!input.name?.trim()) throw new Error('Informe o nome da XADTag.');
    if (!input.traccarUniqueId || input.traccarUniqueId !== input.traccarUniqueId.trim()) throw new Error('traccarUniqueId deve ser informado exatamente, sem espaços externos.');
    if (input.traccarUniqueId.length > 128) throw new Error('traccarUniqueId não pode ultrapassar 128 caracteres.');
    const canonicalOriginal = input.identifierProfile === 'xadtag_legacy_numeric_10_to_15'
      ? originalXadTagIdentifier(input.identifierOriginal)
      : input.identifierOriginal;
    const normalized = normalizeEquipmentIdentifier(input.identifierKind, canonicalOriginal, input.identifierProfile);
    const now = Date.now();
    const pending: Omit<XadTag, 'id'> = {
      // O SN patrimonial permanece exatamente como foi informado. O padding
      // para 15 dígitos pertence somente ao uniqueId enviado ao Traccar.
      tenantId, name: input.name.trim(), type: 'XADTAG', accessoryId: normalized.original,
      equipmentType: 'XADTAG', model: 'XADTAG', identifierKind: normalized.kind,
      identifierProfile: normalized.profile, identifierOriginal: normalized.original,
      identifierNormalized: normalized.normalized, traccarUniqueId: input.traccarUniqueId,
      ...(normalized.kind === 'imei' ? { imei: normalized.normalized, imeiOriginal: normalized.original } : {}),
      ...(normalized.kind === 'mac' ? { macAddress: normalized.normalized } : {}),
      protocol: 'gt06', traccarPort: getTraccarConfig().gt06Port, usesSimCard: false,
      trackingProvider: 'traccar', traccarDeviceId: null, traccarDeviceName: '', traccarPositionId: null,
      traccarStatus: 'unknown', integrationStatus: 'pending', lastIntegrationCheckAt: null,
      ...(input.traqcareId !== undefined ? { traqcareId: input.traqcareId } : {}),
      ...(input.powerType !== undefined ? { powerType: input.powerType } : {}),
      ...(input.batteryWarrantyYears !== undefined ? { batteryWarrantyYears: input.batteryWarrantyYears } : {}),
      createdAt: now, updatedAt: now,
    };
    const reservation = await xadTagRepository.reservePending(pending);
    if (reservation.item.integrationStatus === 'registered') return { item: reservation.item, created: false, localTagCreated: false, reusedExistingDevice: true };
    if (!reservation.ownsLease) return { item: reservation.item, created: false, localTagCreated: false, reusedExistingDevice: false };

    let device: TraccarDevice | null = null;
    try {
      device = await traccarClient.findDeviceByUniqueId(input.traccarUniqueId);
    } catch (error) {
      await xadTagRepository.update(tenantId, reservation.item.id, { integrationStatus: 'pending', integrationErrorCode: error instanceof Error && /tempo/i.test(error.message) ? 'TRACCAR_TIMEOUT' : 'TRACCAR_UNAVAILABLE', integrationLeaseUntil: null, lastIntegrationCheckAt: Date.now() });
      return { item: await xadTagRepository.get(tenantId, reservation.item.id) || reservation.item, created: false, localTagCreated: reservation.created, reusedExistingDevice: false };
    }
    let externalCreated = false;
    if (!device) try {
      device = await traccarClient.createDevice({
        name: buildTraccarDeviceName(tenantSlug, normalized.original), uniqueId: input.traccarUniqueId, disabled: false,
        model: 'XADTAG', category: 'XADTAG', attributes: { equipmentType: 'XADTAG', tenantSlug, platformSource: getTraccarConfig().platformSource, usesSimCard: false, identifierKind: normalized.kind, identifierNormalized: normalized.normalized },
      });
      externalCreated = true;
    } catch (error) {
      if (error instanceof TraccarHttpError && error.status === 400) device = await traccarClient.findDeviceByUniqueId(input.traccarUniqueId);
      if (!device) {
        await xadTagRepository.update(tenantId, reservation.item.id, { integrationStatus: 'pending', integrationErrorCode: error instanceof Error && /tempo/i.test(error.message) ? 'TRACCAR_TIMEOUT' : 'TRACCAR_UNAVAILABLE', integrationLeaseUntil: null, lastIntegrationCheckAt: Date.now() });
        return { item: await xadTagRepository.get(tenantId, reservation.item.id) || reservation.item, created: false, localTagCreated: reservation.created, reusedExistingDevice: false };
      }
    }
    if (device.uniqueId !== input.traccarUniqueId) throw new Error('O Traccar retornou um uniqueId diferente do solicitado.');
    const externalTenant = typeof device.attributes?.tenantSlug === 'string' ? device.attributes.tenantSlug : null;
    if (externalTenant && externalTenant !== tenantSlug) throw new XadTagConflictError('Esta XADTAG já está vinculada a outra empresa.');
    const desiredAttributes = { ...(device.attributes || {}), equipmentType: 'XADTAG', tenantSlug, platformSource: getTraccarConfig().platformSource, usesSimCard: false, identifierKind: normalized.kind, identifierNormalized: normalized.normalized };
    if (!externalCreated && (device.attributes?.tenantSlug !== tenantSlug || device.attributes?.identifierNormalized !== normalized.normalized)) {
      await traccarClient.updateDevice(device.id, { ...device, attributes: desiredAttributes });
      device = await traccarClient.getDevice(device.id);
    }
    const initialRawPosition = device.positionId ? await traccarClient.getPositionById(device.positionId).catch(() => null) : null;
    const initialPosition = initialRawPosition ? await this.resolvePosition(initialRawPosition) : null;
    await xadTagRepository.update(tenantId, reservation.item.id, { traccarDeviceId: device.id, traccarDeviceName: device.name, traccarPositionId: device.positionId ?? null, traccarStatus: communicationStatus(device, initialRawPosition), integrationStatus: 'registered', integrationErrorCode: null, integrationLeaseUntil: null, lastIntegrationCheckAt: Date.now(), ...(initialPosition ? { lastPosition: initialPosition, communicationValidatedAt: Date.now() } : {}) });
    const item = await xadTagRepository.get(tenantId, reservation.item.id) || reservation.item;
    console.info(JSON.stringify({ event: externalCreated ? 'traccar.device.created' : 'traccar.device.reused', requestId: input.requestId, tenantId, equipmentId: item.id, identifierFingerprint: normalized.normalized.slice(-4), traccarDeviceId: device.id }));
    return { item, created: externalCreated, localTagCreated: reservation.created, reusedExistingDevice: !externalCreated };
  }

  async reconcile(item: XadTag, input: { name: string; identifierOriginal: string; traqcareId?: string; powerType?: 'battery' | '12v'; batteryWarrantyYears?: number }) {
    const normalized = normalizeEquipmentIdentifier('numeric_serial', originalXadTagIdentifier(input.identifierOriginal), 'xadtag_legacy_numeric_10_to_15');
    const desiredUniqueId = normalized.normalized;
    const tenantSlug = item.tenantId;
    let device = Number.isInteger(item.traccarDeviceId) ? await traccarClient.getDevice(item.traccarDeviceId as number).catch(() => null) : null;
    const byCorrectUniqueId = await traccarClient.findDeviceByUniqueId(desiredUniqueId);
    if (byCorrectUniqueId && device && byCorrectUniqueId.id !== device.id) throw new XadTagConflictError('O uniqueId correto já está cadastrado em outro dispositivo no Traccar.');
    if (!device) device = byCorrectUniqueId;
    const name = input.name.trim();
    if (!name) throw new Error('Informe o nome da XADTag.');
    const traccarName = buildTraccarDeviceName(tenantSlug, normalized.original);
    const attributes = { ...(device?.attributes || {}), equipmentType: 'XADTAG', tenantSlug, platformSource: getTraccarConfig().platformSource, usesSimCard: false, identifierKind: normalized.kind, identifierNormalized: normalized.normalized };
    const externalTenant = typeof device?.attributes?.tenantSlug === 'string' ? device.attributes.tenantSlug : null;
    if (externalTenant && externalTenant !== tenantSlug) throw new XadTagConflictError('Esta XADTAG já está vinculada a outra empresa.');
    if (device) {
      if (device.uniqueId !== desiredUniqueId || device.name !== traccarName || device.attributes?.identifierNormalized !== normalized.normalized) {
        await traccarClient.updateDevice(device.id, { ...device, name: traccarName, uniqueId: desiredUniqueId, attributes });
        device = await traccarClient.getDevice(device.id);
      }
    } else {
      device = await traccarClient.createDevice({ name: traccarName, uniqueId: desiredUniqueId, disabled: false, model: 'XADTAG', category: 'XADTAG', attributes });
    }
    const rawPosition = device.positionId ? await traccarClient.getPositionById(device.positionId).catch(() => null) : null;
    const position = rawPosition ? await this.resolvePosition(rawPosition) : null;
    await xadTagRepository.replaceIdentity(item, {
      name, accessoryId: normalized.original, identifierKind: normalized.kind,
      identifierProfile: normalized.profile, identifierOriginal: normalized.original,
      identifierNormalized: normalized.normalized, traccarUniqueId: desiredUniqueId,
      traccarDeviceId: device.id, traccarDeviceName: device.name,
      traccarPositionId: device.positionId ?? null, traccarStatus: communicationStatus(device, rawPosition),
      integrationStatus: 'registered', integrationErrorCode: null, integrationLeaseUntil: null,
      lastIntegrationCheckAt: Date.now(), ...(position ? { lastPosition: position, communicationValidatedAt: Date.now() } : {}),
      ...(input.traqcareId !== undefined ? { traqcareId: input.traqcareId } : {}),
      ...(input.powerType !== undefined ? { powerType: input.powerType } : {}),
      ...(input.batteryWarrantyYears !== undefined ? { batteryWarrantyYears: input.batteryWarrantyYears } : {}),
    });
    console.info(JSON.stringify({ event: 'traccar.device.reconciled', tenantId: item.tenantId, equipmentId: item.id, identifierFingerprint: desiredUniqueId.slice(-4), traccarDeviceId: device.id }));
    return await xadTagRepository.get(item.tenantId, item.id) || { ...item, name, identifierOriginal: normalized.original, identifierNormalized: normalized.normalized, traccarUniqueId: desiredUniqueId };
  }

  async check(item: XadTag) {
    if (!Number.isInteger(item.traccarDeviceId)) throw new Error('XADTag ainda não possui traccarDeviceId válido.');
    const deviceId = item.traccarDeviceId as number;
    const device = await traccarClient.getDevice(deviceId);
    const raw = device.positionId ? await traccarClient.getPositionById(device.positionId) : null;
    const position = raw ? await this.resolvePosition(raw) : null;
    const status = communicationStatus(device, raw);
    await xadTagRepository.update(item.tenantId, item.id, { traccarStatus: status, traccarPositionId: device.positionId ?? null, integrationStatus: 'registered', lastIntegrationCheckAt: Date.now(), ...(position ? { lastPosition: position, communicationValidatedAt: Date.now() } : {}) });
    return { found: true, status, lastUpdate: device.lastUpdate ?? raw?.serverTime ?? raw?.fixTime ?? null, hasPosition: Boolean(position), position };
  }
  async history(item: XadTag, from: string, to: string) {
    if (!Number.isInteger(item.traccarDeviceId)) throw new Error('XADTag ainda não possui traccarDeviceId válido.');
    const positions = await traccarClient.getRoute(item.traccarDeviceId as number, from, to);
    return Promise.all(positions.map(position => this.resolvePosition(position)));
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
    if (!item.lastPosition || !Number.isInteger(item.traccarDeviceId)) return null;
    return { ...item.lastPosition, id: `xadtag_${item.identifierNormalized}`, source: 'traccar', equipmentType: 'XADTAG', tenantId: item.tenantId,
      imei: item.imei || '', uniqueId: item.traccarUniqueId, traccarDeviceId: item.traccarDeviceId!,
      linkedEntityId: item.linkedEntityId, linkedEntityName: item.linkedEntityName, status: item.traccarStatus, lastUpdate: item.lastPosition.serverTime };
  }
}
export const xadTagService = new XadTagService();
