import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, Server } from 'node:http';
import type { TraccarPosition } from '@ktag/shared';
import { traccarGet } from './traccarClient.js';

// tenantId → connected WebSocket clients
const clients = new Map<string, Set<WebSocket>>();

export function broadcastPosition(tenantId: string, position: TraccarPosition): void {
  const sockets = clients.get(tenantId);
  if (!sockets?.size) return;
  const msg = JSON.stringify({ type: 'position', data: position });
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

export function broadcastEvent(tenantId: string, event: unknown): void {
  const sockets = clients.get(tenantId);
  if (!sockets?.size) return;
  const msg = JSON.stringify({ type: 'event', data: event });
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

export function broadcastToAll(payload: unknown): void {
  const msg = JSON.stringify(payload);
  for (const sockets of clients.values()) {
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    }
  }
}

export function attachWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws/tracking' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    // Tenant via query param (?tenant=xxx) ou header X-Tenant-Id; fallback dev-tenant
    const tenantId = url.searchParams.get('tenant')
      || (req.headers['x-tenant-id'] as string | undefined)
      || 'dev-tenant';

    if (!clients.has(tenantId)) clients.set(tenantId, new Set());
    clients.get(tenantId)!.add(ws);

    ws.send(JSON.stringify({ type: 'connected', tenantId }));

    ws.on('close', () => {
      clients.get(tenantId)?.delete(ws);
      if (!clients.get(tenantId)?.size) clients.delete(tenantId);
    });
    ws.on('error', () => clients.get(tenantId)?.delete(ws));
  });

  return wss;
}

// Poller: quando TRACCAR_POLL_INTERVAL está definido (ms), faz polling de /positions
// e faz broadcast para todos os clientes conectados. Alternativa ao webhook em dev.
let lastPositions = new Map<number, string>(); // deviceId → JSON hash

export function startPositionPoller(intervalMs: number): void {
  if (intervalMs <= 0) return;

  console.log(`[Traccar] polling de posições a cada ${intervalMs}ms`);

  const poll = async () => {
    try {
      const positions = await traccarGet<TraccarPosition[]>('/positions');
      for (const pos of positions) {
        const key = `${pos.id}-${pos.serverTime}`;
        if (lastPositions.get(pos.deviceId) === key) continue;
        lastPositions.set(pos.deviceId, key);
        // Broadcast para todos (sem discriminação por tenant em dev)
        broadcastToAll({ type: 'position', data: pos });
      }
    } catch (err: any) {
      console.warn('[Traccar poller]', err.message);
    }
  };

  setInterval(poll, intervalMs);
  poll();
}
