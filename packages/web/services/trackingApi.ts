import type { LiveMapTrackedAsset, TrackedPosition, TrackingHistoryPage, XadTag, XadTagCommunicationStatus } from '@ktag/shared';
import { auth } from './firebase';
import { activeTenant } from './activeTenant';
import { trackingHttpUrl, trackingWebSocketUrl } from './trackingEndpoint';
async function request<T>(path: string, init: RequestInit = {}): Promise<T> { const token = await auth?.currentUser?.getIdToken(); if (!token) throw new Error('Autenticação necessária.'); const response = await fetch(trackingHttpUrl(path), { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Id': activeTenant.id, ...(init.headers || {}) } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || 'Falha no serviço de rastreamento.'); return payload.data as T; }
export const trackingApi = {
  registerXadTag: async (input: { name: string; identifierOriginal: string; traqcareId?: string; powerType?: 'battery' | '12v'; batteryWarrantyYears?: number }) => {
    const result = await request<{ tag: XadTag }>('/api/integrations/traccar/xadtags', { method: 'POST', body: JSON.stringify(input) }); return result.tag;
  },
  updateXadTag: (id: string, input: { name: string; identifierOriginal: string; traqcareId?: string; powerType?: 'battery' | '12v'; batteryWarrantyYears?: number }) => request<XadTag>(`/api/integrations/traccar/xadtags/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }),
  retryXadTag: (id: string) => request<XadTag>(`/api/integrations/traccar/xadtags/${encodeURIComponent(id)}/retry`, { method: 'POST', body: '{}' }),
  checkXadTag: (id: string) => request<{ found: boolean; status: XadTagCommunicationStatus; lastUpdate: string | null; hasPosition: boolean; position: TrackedPosition | null }>(`/api/xadtags/${encodeURIComponent(id)}/check`, { method: 'POST', body: '{}' }),
  xadTagHistory: (id: string, from: string, to: string) => request<TrackedPosition[]>(`/api/xadtags/${encodeURIComponent(id)}/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  vehiclePosition: (vehicleId: string, signal?: AbortSignal) => request<any>(`/api/livemap/vehicles/${encodeURIComponent(vehicleId)}/position`, { signal }),
  vehicleHistory: (vehicleId: string, from: string, to: string, cursor?: string, signal?: AbortSignal) => request<TrackingHistoryPage>(`/api/livemap/vehicles/${encodeURIComponent(vehicleId)}/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { signal }),
  tagHistory: (tagId: string, from: string, to: string, cursor?: string, signal?: AbortSignal) => request<TrackingHistoryPage>(`/api/livemap/tags/${encodeURIComponent(tagId)}/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { signal }),
  importCommit: (rows: unknown[]) => request<{ total: number; created: number; existing: number; invalid: number; unavailable: number }>('/api/xadtags/import/commit', { method: 'POST', body: JSON.stringify({ rows }) }),
  liveMap: () => request<LiveMapTrackedAsset[]>('/api/livemap'), adminStatus: () => request<any>('/api/admin/integrations/traccar/status'),
  adminTestWebSocket: () => request<any>('/api/admin/integrations/traccar/test-websocket', { method: 'POST', body: '{}' }),
  websocket: async () => { const token = await auth?.currentUser?.getIdToken(); if (!token) throw new Error('Autenticação necessária.'); return new WebSocket(trackingWebSocketUrl(activeTenant.id), [`firebase.${token}`]); },
};
