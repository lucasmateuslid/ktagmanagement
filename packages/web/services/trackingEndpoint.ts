const configuredBaseUrl = (import.meta.env.VITE_TRACKING_API_URL || '').trim().replace(/\/+$/, '');

/**
 * Produção direciona tracking para o backend dedicado da VPS. Local e sandbox
 * podem omitir VITE_TRACKING_API_URL e continuar usando o proxy same-origin.
 */
export function trackingHttpUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return configuredBaseUrl ? `${configuredBaseUrl}${normalizedPath}` : normalizedPath;
}

export function trackingWebSocketUrl(tenantId: string): string {
  if (!configuredBaseUrl) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/tracking?tenant=${encodeURIComponent(tenantId)}`;
  }
  const url = new URL(configuredBaseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws/tracking';
  url.search = `?tenant=${encodeURIComponent(tenantId)}`;
  return url.toString();
}
