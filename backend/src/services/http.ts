export interface JsonRequestInit extends RequestInit {
  json?: unknown;
}

export const requestJson = async <T>(url: string, init: JsonRequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers ?? {});

  if (init.json !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.error || data?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data as T;
};
