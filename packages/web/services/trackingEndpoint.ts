/** A API de rastreamento usa o mesmo domínio público da aplicação. */
export function trackingHttpUrl(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export function trackingWebSocketUrl(tenantId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/tracking?tenant=${encodeURIComponent(tenantId)}`;
}
