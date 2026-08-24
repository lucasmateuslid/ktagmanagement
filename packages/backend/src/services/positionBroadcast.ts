import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, Server } from 'node:http';
import type { LiveMapTrackedAsset, TraccarPosition } from '@ktag/shared';
import { adminAuth } from './firebaseAdmin.js';
import { adminDb } from './firebaseAdmin.js';

type Subscription = { ws: WebSocket; vehicleIds: Set<string> | null };
const clients = new Map<string, Set<Subscription>>();
export function broadcastTenant(tenantId: string, payload: unknown): void {
  const message = JSON.stringify(payload);
  const data = (payload as any)?.data;
  const linkedEntityId = data?.linkedEntityId ? String(data.linkedEntityId) : null;
  for (const subscription of clients.get(tenantId) || []) {
    if (subscription.ws.readyState !== WebSocket.OPEN) continue;
    if (subscription.vehicleIds && (!linkedEntityId || !subscription.vehicleIds.has(linkedEntityId))) continue;
    subscription.ws.send(message);
  }
}
export const broadcastPosition = (tenantId: string, position: TraccarPosition | LiveMapTrackedAsset) => broadcastTenant(tenantId, { type: 'position', data: position });
export const broadcastEvent = (tenantId: string, event: unknown) => broadcastTenant(tenantId, { type: 'event', data: event });
export const broadcastRemoval = (tenantId: string, markerId: string) => broadcastTenant(tenantId, { type: 'remove', id: markerId });

export function attachWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws/tracking' });
  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    try {
      const origin = String(req.headers.origin || '');
      if (process.env.NODE_ENV === 'production' && !/^https:\/\/([a-z0-9-]+\.)?ktagfinder\.app$/.test(origin)) {
        throw new Error('origin not allowed');
      }
      const protocols = String(req.headers['sec-websocket-protocol'] || '').split(',').map(value => value.trim());
      const token = protocols.find(value => value.startsWith('firebase.'))?.slice('firebase.'.length);
      if (!token) throw new Error('missing token');
      const decoded = await adminAuth.verifyIdToken(token);
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const tenantId = url.searchParams.get('tenant') || '';
      if (!tenantId) throw new Error('forbidden');
      const member = await adminDb.doc(`tenants/${tenantId}/users/${decoded.uid}`).get();
      if (!member.exists || member.get('status') !== 'approved') throw new Error('forbidden');
      let vehicleIds: Set<string> | null = null;
      if (member.get('role') === 'client') {
        const clientId = member.get('clientId');
        if (!clientId) throw new Error('forbidden');
        const vehicles = await adminDb.collection(`tenants/${tenantId}/vehicles`).where('clientId', '==', clientId).get();
        vehicleIds = new Set(vehicles.docs.map(doc => doc.id));
      }
      if (!clients.has(tenantId)) clients.set(tenantId, new Set());
      const subscription: Subscription = { ws, vehicleIds };
      clients.get(tenantId)!.add(subscription);
      ws.send(JSON.stringify({ type: 'connected' }));
      ws.on('close', () => { clients.get(tenantId)?.delete(subscription); if (!clients.get(tenantId)?.size) clients.delete(tenantId); });
      ws.on('error', () => clients.get(tenantId)?.delete(subscription));
    } catch { ws.close(1008, 'unauthorized'); }
  });
  return wss;
}

// Compatibilidade: fallback agora é gerenciado pelo singleton TraccarRealtimeService.
export function startPositionPoller(_intervalMs: number): void {}
