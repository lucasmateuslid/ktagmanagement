import WebSocket from 'ws';
import type { TraccarDevice, TraccarPosition, TraccarRealtimeStatus, TraccarSocketMessage, XadTag } from '@ktag/shared';
import { getTraccarConfig } from '../config/traccar.js';
import { xadTagRepository } from '../repositories/xadtagRepository.js';
import { broadcastPosition } from './positionBroadcast.js';
import { traccarClient } from './traccarClient.js';
import { toTrackedPosition, xadTagService } from './xadtagService.js';
import { adminDb } from './firebaseAdmin.js';
import { afterVehicleLink, canPromotePosition, canPromoteVehiclePosition, validPosition, withoutUndefined } from './currentPosition.js';

export class TraccarRealtimeService {
  private socket: WebSocket | null = null;
  private reconnectTimer?: NodeJS.Timeout;
  private fallbackTimer?: NodeJS.Timeout;
  private mappingTimer?: NodeJS.Timeout;
  private attempt = 0;
  private stopped = true;
  private mapping = new Map<number, { tenantId: string; equipmentId: string; uniqueId: string; equipmentType: 'XADTAG' | 'K_TAG' }>();
  private lastPosition = new Map<number, { id: number; time: number }>();
  private devices = new Map<number, TraccarDevice>();
  private equipment = new Map<number, XadTag>();
  private lastPersistAt = new Map<number, number>();
  status: TraccarRealtimeStatus = 'disconnected';
  lastMessageAt: string | null = null;
  lastSnapshotAt: string | null = null;
  reconnects = 0;

  async start() { if (!this.stopped) return; this.stopped = false; await this.refreshMapping(); this.mappingTimer = setInterval(() => void this.refreshMapping().catch(error => console.warn(JSON.stringify({ event: 'traccar.mapping.refresh_failed', error: (error as Error).message }))), 60_000); await this.connect(); }
  stop() { this.stopped = true; clearTimeout(this.reconnectTimer); clearInterval(this.fallbackTimer); clearInterval(this.mappingTimer); this.socket?.close(); this.socket = null; this.status = 'disconnected'; }
  async refreshMapping() {
    const xad = await xadTagRepository.buildDeviceMapping();
    const ktag = await adminDb.collectionGroup('tags').where('type', '==', 'K_TAG').get();
    this.mapping = new Map<number, { tenantId: string; equipmentId: string; uniqueId: string; equipmentType: 'XADTAG' | 'K_TAG' }>([
      ...[...xad.entries()].map(([id, value]) => [id, { ...value, equipmentType: 'XADTAG' as const }] as const),
      ...ktag.docs.filter(doc => Number.isInteger(doc.get('traccarDeviceId')) && doc.get('integrationStatus') === 'registered')
        .map(doc => [Number(doc.get('traccarDeviceId')), { tenantId: String(doc.ref.parent.parent?.id || ''), equipmentId: doc.id,
          uniqueId: String(doc.get('traccarUniqueId') || ''), equipmentType: 'K_TAG' as const }] as const),
    ]);
    this.equipment.clear();
  }
  get diagnostics() { return { connected: this.status === 'connected', status: this.status, lastMessageAt: this.lastMessageAt, lastSnapshotAt: this.lastSnapshotAt, reconnects: this.reconnects }; }

  private async connect() {
    if (this.stopped || this.socket) return;
    this.status = this.attempt ? 'reconnecting' : 'disconnected';
    try {
      const cookie = await traccarClient.createSession();
      this.socket = new WebSocket(getTraccarConfig().wsUrl, { headers: { Cookie: cookie } });
      this.socket.on('open', () => { this.status = 'connected'; this.attempt = 0; this.stopFallback(); console.info(JSON.stringify({ event: 'traccar.websocket.connected' })); void this.snapshot(); });
      this.socket.on('message', data => { this.lastMessageAt = new Date().toISOString(); void this.handleMessage(String(data)).catch(error => console.error(JSON.stringify({ event: 'traccar.websocket.message_failed', error: (error as Error).message }))); });
      this.socket.on('close', () => this.disconnected());
      this.socket.on('error', error => console.warn(JSON.stringify({ event: 'traccar.websocket.disconnected', error: error.message })));
    } catch { this.disconnected(); }
  }
  private disconnected() { this.socket?.removeAllListeners(); this.socket = null; if (this.stopped) return; this.startFallback(); this.scheduleReconnect(); }
  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const cfg = getTraccarConfig();
    const base = Math.min(cfg.reconnectMaxMs, cfg.reconnectMinMs * 2 ** this.attempt++);
    const delay = Math.round(base * (0.8 + Math.random() * 0.4));
    this.status = 'reconnecting'; this.reconnects++;
    console.info(JSON.stringify({ event: 'traccar.websocket.reconnecting', delayMs: delay }));
    this.reconnectTimer = setTimeout(() => { this.reconnectTimer = undefined; void this.connect(); }, delay);
  }
  private startFallback() { if (this.fallbackTimer) return; this.status = 'rest_fallback'; const interval = getTraccarConfig().restFallbackIntervalMs; this.fallbackTimer = setInterval(() => void this.snapshot(), interval); void this.snapshot(); }
  private stopFallback() { if (this.fallbackTimer) clearInterval(this.fallbackTimer); this.fallbackTimer = undefined; }
  async snapshot() { try { const positions = await traccarClient.getLatestPositions(); this.lastSnapshotAt = new Date().toISOString(); await this.handlePositions(positions); } catch { /* conserva snapshot anterior */ } }
  async handleMessage(raw: string) { let message: TraccarSocketMessage; try { message = JSON.parse(raw) as TraccarSocketMessage; } catch { return; } if (message.devices) for (const device of message.devices) this.devices.set(device.id, device); if (message.positions) await this.handlePositions(message.positions); }
  async handlePositions(positions: TraccarPosition[]) {
    for (const raw of positions) {
      const mapping = this.mapping.get(raw.deviceId); if (!mapping) continue;
      const time = Date.parse(raw.fixTime || raw.deviceTime || raw.serverTime || '') || 0;
      if (!Number.isFinite(time) || time <= 0 || raw.valid === false || !Number.isFinite(raw.latitude) || !Number.isFinite(raw.longitude)
        || Math.abs(raw.latitude) > 90 || Math.abs(raw.longitude) > 180 || (raw.latitude === 0 && raw.longitude === 0)) continue;
      const previous = this.lastPosition.get(raw.deviceId);
      if (previous && (raw.id === previous.id || (raw.id < previous.id && time <= previous.time))) continue;
      if (mapping.equipmentType === 'K_TAG') {
        try {
          const point = withoutUndefined({ id: String(raw.id), tagId: mapping.equipmentId, provider: 'traccar', timestamp: time,
            lat: raw.latitude, lon: raw.longitude, address: raw.address || null, addressResolutionProvider: raw.address ? 'traccar' : null,
            speed: raw.speed, course: raw.course, altitude: raw.altitude });
          if (!validPosition(point)) continue;
          const tagRef = adminDb.doc(`tenants/${mapping.tenantId}/tags/${mapping.equipmentId}`);
          const vehicles = await adminDb.collection(`tenants/${mapping.tenantId}/vehicles`).where('tagId', '==', mapping.equipmentId).limit(2).get();
          if (vehicles.size > 1) { console.warn(JSON.stringify({ event: 'traccar.position.duplicate_assignment', tagId: mapping.equipmentId })); continue; }
          const vehicleRef = vehicles.docs[0]?.ref;
          const accepted = await adminDb.runTransaction(async tx => {
            const [tag, vehicle] = await Promise.all([tx.get(tagRef), vehicleRef ? tx.get(vehicleRef) : Promise.resolve(null)]);
            if (!tag.exists || tag.get('traccarDeviceId') !== raw.deviceId || tag.get('traccarUniqueId') !== mapping.uniqueId) return false;
            if (canPromotePosition(tag.id, point, tag.get('lastPosition'))) tx.update(tagRef, { lastPosition: point, communicationValidatedAt: Date.now(), traccarPositionId: raw.id });
            if (vehicle && afterVehicleLink(point.timestamp, vehicle.get('trackingLinkedAt')) && canPromoteVehiclePosition(vehicle.get('tagId'), vehicle.get('trackerId'), point, vehicle.get('lastPosition'))) tx.update(vehicle.ref, { lastPosition: { ...point, vehicleId: vehicle.id }, lastPositionUpdatedAt: Date.now() });
            return true;
          });
          if (!accepted) continue;
          this.lastPosition.set(raw.deviceId, { id: raw.id, time });
          if (vehicleRef && afterVehicleLink(point.timestamp, vehicles.docs[0].get('trackingLinkedAt'))) broadcastPosition(mapping.tenantId, { id: `ktag_${mapping.equipmentId}`, equipmentId: mapping.equipmentId,
            equipmentType: 'K_TAG', source: 'traccar', tenantId: mapping.tenantId, linkedEntityId: vehicleRef.id,
            imei: mapping.uniqueId, uniqueId: mapping.uniqueId, traccarDeviceId: raw.deviceId, latitude: raw.latitude, longitude: raw.longitude,
            valid: raw.valid, fixTime: raw.fixTime, deviceTime: raw.deviceTime, serverTime: raw.serverTime,
            address: raw.address || null, status: 'online', attributes: raw.attributes || {} });
        } catch (error) { console.error(JSON.stringify({ event: 'traccar.ktag.persist_failed', deviceId: raw.deviceId, error: (error as Error).message })); }
        continue;
      }
      let item = this.equipment.get(raw.deviceId);
      if (!item) { item = await xadTagRepository.get(mapping.tenantId, mapping.equipmentId) || undefined; if (!item) continue; this.equipment.set(raw.deviceId, item); }
      const device = this.devices.get(raw.deviceId);
      const previousStatus = item.traccarStatus;
      // XADTAGs abrem uma conexão curta, enviam o lote e desconectam. A chegada
      // de uma posição válida é a evidência de atividade, independentemente do socket.
      item.traccarStatus = 'online';
      const now = Date.now();
      const shouldPersist = !this.lastPersistAt.has(raw.deviceId)
        || now - this.lastPersistAt.get(raw.deviceId)! >= getTraccarConfig().positionPersistIntervalMs
        || previousStatus !== item.traccarStatus;
      const tracked = shouldPersist
        ? await xadTagService.resolvePosition(raw)
        : toTrackedPosition(raw, raw.address || null);
      item.lastPosition = tracked;
      if (shouldPersist) {
        try {
          await xadTagRepository.persistPosition(item, tracked);
          const vehicles = await adminDb.collection(`tenants/${mapping.tenantId}/vehicles`).where('tagId', '==', item.id).limit(2).get();
          if (vehicles.size === 1) {
            const vehicleRef = vehicles.docs[0].ref;
            const point = withoutUndefined({ id: String(raw.id), vehicleId: vehicles.docs[0].id, tagId: item.id, provider: 'traccar', timestamp: time, lat: raw.latitude, lon: raw.longitude, address: tracked.address || null, addressResolutionProvider: raw.address ? 'traccar' : null, speed: raw.speed, course: raw.course, altitude: raw.altitude });
            await adminDb.runTransaction(async transaction => { const current = await transaction.get(vehicleRef); if (afterVehicleLink(time, current.get('trackingLinkedAt')) && canPromoteVehiclePosition(current.get('tagId'), current.get('trackerId'), point, current.get('lastPosition'))) transaction.update(vehicleRef, { lastPosition: point, lastPositionUpdatedAt: now }); });
          }
          this.lastPersistAt.set(raw.deviceId, now);
        } catch (error) {
          // Uma posição inválida não pode encerrar o worker nem derrubar a API.
          console.error(JSON.stringify({ event: 'traccar.position.persist_failed', deviceId: raw.deviceId, error: (error as Error).message }));
        }
      }
      const asset = xadTagService.toLiveMap(item); if (asset) broadcastPosition(mapping.tenantId, asset);
      this.lastPosition.set(raw.deviceId, { id: raw.id, time });
    }
  }
}
export const traccarRealtimeService = new TraccarRealtimeService();
