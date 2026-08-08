import type { LiveMapTrackedAsset, XadTag } from '@ktag/shared';
import { auth } from './firebase';
import { activeTenant } from './activeTenant';
import { trackingHttpUrl, trackingWebSocketUrl } from './trackingEndpoint';
async function request<T>(path: string, init: RequestInit = {}): Promise<T> { const token = await auth?.currentUser?.getIdToken(); if (!token) throw new Error('Autenticação necessária.'); const response = await fetch(trackingHttpUrl(path), { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Id': activeTenant.id, ...(init.headers || {}) } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || 'Falha no serviço de rastreamento.'); return payload.data as T; }
export const trackingApi = {
  registerXadTag: (imei: string, description?: string) => request<XadTag>('/api/xadtags', { method: 'POST', body: JSON.stringify({ imei, description }) }),
  checkXadTag: (id: string) => request<unknown>(`/api/xadtags/${encodeURIComponent(id)}/check`, { method: 'POST', body: '{}' }),
  importCommit: (rows: unknown[]) => request<{ total: number; created: number; existing: number; invalid: number; unavailable: number }>('/api/xadtags/import/commit', { method: 'POST', body: JSON.stringify({ rows }) }),
  liveMap: () => request<LiveMapTrackedAsset[]>('/api/livemap'), adminStatus: () => request<any>('/api/admin/integrations/traccar/status'),
  adminTestWebSocket: () => request<any>('/api/admin/integrations/traccar/test-websocket', { method: 'POST', body: '{}' }),
  websocket: async () => { const token = await auth?.currentUser?.getIdToken(); if (!token) throw new Error('Autenticação necessária.'); return new WebSocket(trackingWebSocketUrl(activeTenant.id), [`firebase.${token}`]); },
};
