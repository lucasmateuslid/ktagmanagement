import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, Server } from 'node:http';
import type { LiveMapTrackedAsset, TraccarPosition } from '@ktag/shared';
import { adminAuth } from './firebaseAdmin.js';

const clients = new Map<string, Set<WebSocket>>();
export function broadcastTenant(tenantId: string, payload: unknown): void {
  const message = JSON.stringify(payload);
  for (const socket of clients.get(tenantId) || []) if (socket.readyState === WebSocket.OPEN) socket.send(message);
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
      const hasMembership = decoded.superadmin === true || (typeof decoded.tn === 'object' && decoded.tn && Boolean((decoded.tn as Record<string, unknown>)[tenantId])) || decoded.tenantId === tenantId;
      if (!tenantId || !hasMembership) throw new Error('forbidden');
      if (!clients.has(tenantId)) clients.set(tenantId, new Set());
      clients.get(tenantId)!.add(ws);
      ws.send(JSON.stringify({ type: 'connected' }));
      ws.on('close', () => { clients.get(tenantId)?.delete(ws); if (!clients.get(tenantId)?.size) clients.delete(tenantId); });
      ws.on('error', () => clients.get(tenantId)?.delete(ws));
    } catch { ws.close(1008, 'unauthorized'); }
  });
  return wss;
}

// Compatibilidade: fallback agora é gerenciado pelo singleton TraccarRealtimeService.
export function startPositionPoller(_intervalMs: number): void {}
