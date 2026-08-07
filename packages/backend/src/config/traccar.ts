export interface TraccarConfig {
  apiUrl: string;
  webUrl: string;
  wsUrl: string;
  token?: string;
  email?: string;
  password?: string;
  requestTimeoutMs: number;
  gt06Port: number;
  platformSource: string;
  reconnectMinMs: number;
  reconnectMaxMs: number;
  restFallbackIntervalMs: number;
  addressCacheTtlMs: number;
  positionCacheTtlMs: number;
  positionPersistIntervalMs: number;
  writeTestEnabled: boolean;
}

export function normalizeTraccarApiUrl(value: string): string {
  const clean = value.trim().replace(/\/+$/, '');
  if (!clean) return '';
  return clean.endsWith('/api') ? clean : `${clean}/api`;
}

const positive = (name: string, fallback: number): number => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} deve ser um número positivo.`);
  return value;
};

export function getTraccarConfig(): TraccarConfig {
  const legacyBase = process.env.TRACCAR_INTERNAL_URL;
  const apiUrl = normalizeTraccarApiUrl(process.env.TRACCAR_API_URL || legacyBase || '');
  const webUrl = (process.env.TRACCAR_WEB_URL || legacyBase || '').replace(/\/+$/, '');
  const wsUrl = process.env.TRACCAR_WS_URL || (webUrl ? `${webUrl.replace(/^http/, 'ws')}/api/socket` : '');
  return {
    apiUrl, webUrl, wsUrl,
    token: process.env.TRACCAR_API_TOKEN || process.env.TRACCAR_ADMIN_TOKEN || undefined,
    email: process.env.TRACCAR_EMAIL || undefined,
    password: process.env.TRACCAR_PASSWORD || undefined,
    requestTimeoutMs: positive('TRACCAR_REQUEST_TIMEOUT_MS', 10_000),
    gt06Port: positive('TRACCAR_GT06_PORT', 5023),
    platformSource: process.env.TRACCAR_PLATFORM_SOURCE || 'KTagFinder',
    reconnectMinMs: positive('TRACCAR_WS_RECONNECT_MIN_MS', 1_000),
    reconnectMaxMs: positive('TRACCAR_WS_RECONNECT_MAX_MS', 30_000),
    restFallbackIntervalMs: positive('TRACCAR_REST_FALLBACK_INTERVAL_MS', 30_000),
    addressCacheTtlMs: positive('TRACCAR_ADDRESS_CACHE_TTL_MS', 300_000),
    positionCacheTtlMs: positive('TRACCAR_POSITION_CACHE_TTL_MS', 15_000),
    positionPersistIntervalMs: positive('TRACCAR_POSITION_PERSIST_INTERVAL_MS', 300_000),
    writeTestEnabled: process.env.TRACCAR_WRITE_TEST_ENABLED === 'true',
  };
}

export function validateTraccarConfig(config = getTraccarConfig()): string[] {
  const errors: string[] = [];
  if (!config.apiUrl) errors.push('TRACCAR_API_URL não configurada');
  if (!config.wsUrl) errors.push('TRACCAR_WS_URL não configurada');
  if (!config.token && !(config.email && config.password)) errors.push('configure TRACCAR_API_TOKEN ou TRACCAR_EMAIL/TRACCAR_PASSWORD');
  if (config.reconnectMinMs > config.reconnectMaxMs) errors.push('TRACCAR_WS_RECONNECT_MIN_MS não pode exceder o máximo');
  return errors;
}
