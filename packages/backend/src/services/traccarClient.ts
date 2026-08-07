import type { TraccarDevice, TraccarPosition } from '@ktag/shared';
import { getTraccarConfig, type TraccarConfig } from '../config/traccar.js';

export class TraccarHttpError extends Error {
  constructor(public status: number, public operation: string, message: string) { super(message); }
}

type RequestOptions = RequestInit & { operation?: string; auth?: boolean };

export class TraccarClient {
  private sessionCookie = '';
  private pendingSession: Promise<string> | null = null;
  constructor(private readonly config: TraccarConfig = getTraccarConfig(), private readonly fetcher: typeof fetch = fetch) {}

  get safeConfig() { return { configured: Boolean(this.config.apiUrl && (this.config.token || this.config.email)), webUrl: this.config.webUrl }; }

  private authHeader(): string | undefined {
    if (this.config.token) return `Bearer ${this.config.token}`;
    if (this.config.email && this.config.password) return `Basic ${Buffer.from(`${this.config.email}:${this.config.password}`).toString('base64')}`;
    return undefined;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    const started = Date.now();
    const operation = options.operation || `${options.method || 'GET'} ${path.split('?')[0]}`;
    const auth = options.auth !== false ? this.authHeader() : undefined;
    try {
      console.info(JSON.stringify({ event: 'traccar.rest.request', operation }));
      const response = await this.fetcher(`${this.config.apiUrl}${path.startsWith('/') ? path : `/${path}`}`, {
        ...options, signal: controller.signal,
        headers: { Accept: 'application/json, text/plain', ...(auth ? { Authorization: auth } : {}), ...(options.headers || {}) },
      });
      const text = response.status === 204 ? '' : await response.text();
      if (!response.ok) throw new TraccarHttpError(response.status, operation, `Traccar respondeu HTTP ${response.status}.`);
      console.info(JSON.stringify({ event: 'traccar.rest.success', operation, statusCode: response.status, latencyMs: Date.now() - started }));
      if (!text) return undefined as T;
      const contentType = response.headers.get('content-type') || '';
      return (contentType.includes('json') ? JSON.parse(text) : text) as T;
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError' ? 'Tempo limite excedido ao consultar o Traccar.' : (error as Error).message;
      console.error(JSON.stringify({ event: 'traccar.rest.failure', operation, latencyMs: Date.now() - started, error: message }));
      if (error instanceof TraccarHttpError) throw error;
      throw new Error(message);
    } finally { clearTimeout(timeout); }
  }

  health() { return this.request<unknown>('/health', { auth: false, operation: 'health' }); }
  getSession() { return this.request<Record<string, unknown>>('/session', { operation: 'getSession' }); }
  async findDeviceByUniqueId(uniqueId: string) {
    const devices = await this.request<TraccarDevice[]>(`/devices?uniqueId=${encodeURIComponent(uniqueId)}`, { operation: 'findDeviceByUniqueId' });
    return devices.find(device => device.uniqueId === uniqueId) ?? null;
  }
  getDevice(id: number) { return this.request<TraccarDevice>(`/devices/${id}`, { operation: 'getDevice' }); }
  createDevice(input: Omit<TraccarDevice, 'id' | 'status'>) { return this.request<TraccarDevice>('/devices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), operation: 'createDevice' }); }
  updateDevice(id: number, input: Partial<TraccarDevice>) { return this.request<TraccarDevice>(`/devices/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), operation: 'updateDevice' }); }
  deleteDevice(id: number) { return this.request<void>(`/devices/${id}`, { method: 'DELETE', operation: 'deleteDevice' }); }
  async getPositionById(id: number) { const values = await this.request<TraccarPosition[]>(`/positions?id=${id}`, { operation: 'getPositionById' }); return values[0] ?? null; }
  getLatestPositions() { return this.request<TraccarPosition[]>('/positions', { operation: 'getLatestPositions' }); }
  async reverseGeocode(latitude: number, longitude: number) {
    const value = await this.request<string>(`/server/geocode?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`, { operation: 'reverseGeocode' });
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  async createSession(): Promise<string> {
    if (this.sessionCookie) return this.sessionCookie;
    if (this.pendingSession) return this.pendingSession;
    this.pendingSession = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
      try {
        let body: URLSearchParams | undefined;
        let url = `${this.config.apiUrl}/session`;
        if (this.config.token) url += `?token=${encodeURIComponent(this.config.token)}`;
        else body = new URLSearchParams({ email: this.config.email || '', password: this.config.password || '' });
        const response = await this.fetcher(url, { method: 'POST', body, signal: controller.signal, headers: body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined });
        if (!response.ok) throw new Error(`Não foi possível criar sessão Traccar (HTTP ${response.status}).`);
        const raw = response.headers.get('set-cookie') || '';
        const match = raw.match(/JSESSIONID=([^;,\s]+)/);
        if (!match) throw new Error('Traccar não retornou cookie de sessão.');
        this.sessionCookie = `JSESSIONID=${match[1]}`;
        return this.sessionCookie;
      } finally { clearTimeout(timeout); }
    })().finally(() => { this.pendingSession = null; });
    return this.pendingSession;
  }
  invalidateSession() { this.sessionCookie = ''; }
}

export const traccarClient = new TraccarClient();
export const traccarGet = <T>(path: string) => traccarClient.request<T>(path);
export const traccarPost = <T>(path: string, body: unknown) => traccarClient.request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const traccarDelete = (path: string) => traccarClient.request<void>(path, { method: 'DELETE' });
export const initTraccarSession = async () => { await traccarClient.createSession(); };
