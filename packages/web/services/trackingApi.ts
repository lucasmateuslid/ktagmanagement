import type { LiveMapTrackedAsset, TrackedPosition, TrackingHistoryPage, TrackingHistoryPoint, TrackingHistoryWarning, XadTag, XadTagCommunicationStatus } from '@ktag/shared';
import { auth } from './firebase';
import { activeTenant } from './activeTenant';
import { trackingHttpUrl, trackingWebSocketUrl } from './trackingEndpoint';
export class TrackingApiError extends Error {
  constructor(message: string, public errorCode = 'TRACKING_UNAVAILABLE', public requestId?: string, public status?: number) { super(message); }
}
const friendlyHistoryError = (code: string) => ({
  INVALID_RANGE: 'O período informado é inválido.', INVALID_CURSOR: 'A página solicitada expirou. Refaça a pesquisa.',
  DEVICE_NOT_LINKED: 'O rastreador ainda não está vinculado ao provedor.', UNKNOWN_DEVICE_TYPE: 'Este equipamento não oferece histórico.',
  PROVIDER_TIMEOUT: 'O provedor demorou para responder. Tente novamente.', PROVIDER_RATE_LIMITED: 'O provedor está temporariamente ocupado. Tente novamente em instantes.',
  PROVIDER_NOT_CONFIGURED: 'A integração de rastreamento não está configurada.', PROVIDER_UNAUTHORIZED: 'A integração de rastreamento precisa ser revisada.',
  RATE_LIMITED: 'Muitas consultas seguidas. Aguarde um instante.',
} as Record<string, string>)[code] || 'Não foi possível recuperar o histórico agora.';
async function request<T>(path: string, init: RequestInit = {}): Promise<T> { const token = await auth?.currentUser?.getIdToken(); if (!token) throw new Error('Autenticação necessária.'); const response = await fetch(trackingHttpUrl(path), { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Id': activeTenant.id, ...(init.headers || {}) } }); const payload = await response.json().catch(() => ({})); if (!response.ok) { const code = String(payload.errorCode || 'TRACKING_UNAVAILABLE'); throw new TrackingApiError(friendlyHistoryError(code), code, payload.requestId, response.status); } return payload.data as T; }
export const trackingApi = {
  registerXadTag: async (input: { name: string; identifierOriginal: string; traqcareId?: string; powerType?: 'battery' | '12v'; batteryWarrantyYears?: number; batteryStartedAt?: number }) => {
    const result = await request<{ tag: XadTag }>('/api/integrations/traccar/xadtags', { method: 'POST', body: JSON.stringify(input) }); return result.tag;
  },
  updateXadTag: (id: string, input: { name: string; identifierOriginal: string; traqcareId?: string; powerType?: 'battery' | '12v'; batteryWarrantyYears?: number; batteryStartedAt?: number }) => request<XadTag>(`/api/integrations/traccar/xadtags/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }),
  retryXadTag: (id: string) => request<XadTag>(`/api/integrations/traccar/xadtags/${encodeURIComponent(id)}/retry`, { method: 'POST', body: '{}' }),
  checkXadTag: (id: string) => request<{ found: boolean; status: XadTagCommunicationStatus; lastUpdate: string | null; hasPosition: boolean; position: TrackedPosition | null }>(`/api/xadtags/${encodeURIComponent(id)}/check`, { method: 'POST', body: '{}' }),
  xadTagHistory: (id: string, from: string, to: string) => request<TrackedPosition[]>(`/api/xadtags/${encodeURIComponent(id)}/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  vehiclePosition: (vehicleId: string, signal?: AbortSignal) => request<any>(`/api/livemap/vehicles/${encodeURIComponent(vehicleId)}/position`, { signal }),
  vehicleHistory: (vehicleId: string, from: string, to: string, cursor?: string, signal?: AbortSignal, limit?: number) => request<TrackingHistoryPage>(`/api/livemap/vehicles/${encodeURIComponent(vehicleId)}/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}${limit ? `&limit=${limit}` : ''}`, { signal }),
  allVehicleHistory: async (vehicleId: string, from: string, to: string, signal?: AbortSignal) => {
    const points: TrackingHistoryPoint[] = []; const warnings: TrackingHistoryWarning[] = []; const cursors = new Set<string>(); let cursor: string | undefined; let partial = false; let requestId = '';
    do {
      const page = await trackingApi.vehicleHistory(vehicleId, from, to, cursor, signal, 1500);
      requestId = page.requestId; points.push(...page.points); warnings.push(...page.warnings); partial ||= page.partial;
      const next = page.nextCursor || undefined;
      if (next && cursors.has(next)) throw new TrackingApiError('A paginação do histórico não avançou.', 'INVALID_CURSOR', requestId);
      if (next) cursors.add(next); cursor = next;
    } while (cursor);
    return { requestId, points, warnings, partial };
  },
  tagHistory: (tagId: string, from: string, to: string, cursor?: string, signal?: AbortSignal) => request<TrackingHistoryPage>(`/api/livemap/tags/${encodeURIComponent(tagId)}/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { signal }),
  importCommit: (rows: unknown[]) => request<{ total: number; created: number; existing: number; invalid: number; unavailable: number }>('/api/xadtags/import/commit', { method: 'POST', body: JSON.stringify({ rows }) }),
  liveMap: () => request<LiveMapTrackedAsset[]>('/api/livemap'), adminStatus: () => request<any>('/api/admin/integrations/traccar/status'),
  adminTestWebSocket: () => request<any>('/api/admin/integrations/traccar/test-websocket', { method: 'POST', body: '{}' }),
  websocket: async () => { const token = await auth?.currentUser?.getIdToken(); if (!token) throw new Error('Autenticação necessária.'); return new WebSocket(trackingWebSocketUrl(activeTenant.id), [`firebase.${token}`]); },
};
