import WebSocket from 'ws';
import type { TraccarDevice, TraccarPosition, TraccarRealtimeStatus, TraccarSocketMessage, XadTag } from '@ktag/shared';
import { getTraccarConfig } from '../config/traccar.js';
import { xadTagRepository } from '../repositories/xadtagRepository.js';
import { broadcastPosition } from './positionBroadcast.js';
import { traccarClient } from './traccarClient.js';
import { toTrackedPosition, xadTagService } from './xadtagService.js';

export class TraccarRealtimeService {
  private socket: WebSocket | null = null;
  private reconnectTimer?: NodeJS.Timeout;
  private fallbackTimer?: NodeJS.Timeout;
  private attempt = 0;
  private stopped = true;
  private mapping = new Map<number, { tenantId: string; equipmentId: string; uniqueId: string }>();
  private lastPosition = new Map<number, { id: number; time: number }>();
  private devices = new Map<number, TraccarDevice>();
  private equipment = new Map<number, XadTag>();
  private lastPersistAt = new Map<number, number>();
  status: TraccarRealtimeStatus = 'disconnected';
  lastMessageAt: string | null = null;
  lastSnapshotAt: string | null = null;
  reconnects = 0;

  async start() { if (!this.stopped) return; this.stopped = false; await this.refreshMapping(); await this.connect(); }
  stop() { this.stopped = true; clearTimeout(this.reconnectTimer); clearInterval(this.fallbackTimer); this.socket?.close(); this.socket = null; this.status = 'disconnected'; }
  async refreshMapping() { this.mapping = await xadTagRepository.buildDeviceMapping(); this.equipment.clear(); }
  get diagnostics() { return { connected: this.status === 'connected', status: this.status, lastMessageAt: this.lastMessageAt, lastSnapshotAt: this.lastSnapshotAt, reconnects: this.reconnects }; }

  private async connect() {
    if (this.stopped || this.socket) return;
    this.status = this.attempt ? 'reconnecting' : 'disconnected';
    try {
      const cookie = await traccarClient.createSession();
      this.socket = new WebSocket(getTraccarConfig().wsUrl, { headers: { Cookie: cookie } });
      this.socket.on('open', () => { this.status = 'connected'; this.attempt = 0; this.stopFallback(); console.info(JSON.stringify({ event: 'traccar.websocket.connected' })); void this.snapshot(); });
      this.socket.on('message', data => { this.lastMessageAt = new Date().toISOString(); void this.handleMessage(String(data)); });
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
      const time = Date.parse(raw.fixTime || raw.serverTime || '') || 0;
      const previous = this.lastPosition.get(raw.deviceId);
      if (previous && (raw.id === previous.id || (raw.id < previous.id && time <= previous.time))) continue;
      this.lastPosition.set(raw.deviceId, { id: raw.id, time });
      let item = this.equipment.get(raw.deviceId);
      if (!item) { item = await xadTagRepository.get(mapping.tenantId, mapping.equipmentId) || undefined; if (!item) continue; this.equipment.set(raw.deviceId, item); }
      const device = this.devices.get(raw.deviceId);
      const previousStatus = item.traccarStatus;
      if (device) item.traccarStatus = device.status === 'online' ? 'online' : 'offline';
      const now = Date.now();
      const shouldPersist = !this.lastPersistAt.has(raw.deviceId)
        || now - this.lastPersistAt.get(raw.deviceId)! >= getTraccarConfig().positionPersistIntervalMs
        || previousStatus !== item.traccarStatus;
      const tracked = shouldPersist
        ? await xadTagService.resolvePosition(raw)
        : toTrackedPosition(raw, item.lastPosition?.address || null);
      item.lastPosition = tracked;
      if (shouldPersist) {
        try {
          await xadTagRepository.persistPosition(item, tracked);
          this.lastPersistAt.set(raw.deviceId, now);
        } catch (error) {
          // Uma posição inválida não pode encerrar o worker nem derrubar a API.
          console.error(JSON.stringify({ event: 'traccar.position.persist_failed', deviceId: raw.deviceId, error: (error as Error).message }));
        }
      }
      const asset = xadTagService.toLiveMap(item); if (asset) broadcastPosition(mapping.tenantId, asset);
    }
  }
}
export const traccarRealtimeService = new TraccarRealtimeService();
