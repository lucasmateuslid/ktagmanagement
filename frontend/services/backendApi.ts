type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
}

export interface PublicRuntimeConfig {
  maps?: {
    googleMapsPublicKey?: string;
  };
}

export interface BackendLoginUser {
  id: string;
  name: string;
  email: string;
  role?: 'admin' | 'moderator' | 'user' | 'client';
  status?: 'pending' | 'approved' | 'rejected';
  companySlug?: string;
  avatarInitial?: string;
}

export interface BackendLoginResponse {
  token: string;
  user: BackendLoginUser;
}

const trimTrailingSlash = (value: string) => value.replace(/\/$/, '');

const backendBaseUrl = trimTrailingSlash(import.meta.env.VITE_BACKEND_API_URL || '');
const backendPublicUrl = backendBaseUrl ? `${backendBaseUrl}/public` : '';
const backendApiUrl = backendBaseUrl ? `${backendBaseUrl}/api` : '';
const BACKEND_SESSION_KEY = 'ktag_backend_session_token';

let publicConfigPromise: Promise<PublicRuntimeConfig | null> | null = null;

const buildUrl = (baseUrl: string, path: string, query?: RequestOptions['query']) => {
  const url = new URL(`${baseUrl}${path}`);

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
};

const parseError = async (response: Response) => {
  const text = await response.text();

  try {
    const data = text ? JSON.parse(text) : {};
    return data.error || data.message || `HTTP ${response.status}`;
  } catch {
    return text || `HTTP ${response.status}`;
  }
};

const request = async <T>(baseUrl: string, path: string, options: RequestOptions = {}): Promise<T> => {
  if (!baseUrl) {
    throw new Error('Backend API URL not configured.');
  }

  const authToken = typeof window !== 'undefined' ? localStorage.getItem(BACKEND_SESSION_KEY) : null;

  const response = await fetch(buildUrl(baseUrl, path, options.query), {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {})
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<T>;
};

export const backendApi = {
  isConfigured: () => Boolean(backendBaseUrl),

  getSessionToken: () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(BACKEND_SESSION_KEY);
  },

  setSessionToken: (token: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(BACKEND_SESSION_KEY, token);
  },

  clearSessionToken: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(BACKEND_SESSION_KEY);
  },

  getPublicConfig: async () => {
    if (!backendPublicUrl) {
      return null;
    }

    if (!publicConfigPromise) {
      publicConfigPromise = request<PublicRuntimeConfig>(backendPublicUrl, '/config').catch(() => null);
    }

    return publicConfigPromise;
  },

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body' | 'method'>) =>
    request<T>(backendApiUrl, path, { ...options, method: 'POST', body }),

  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body' | 'method'>) =>
    request<T>(backendApiUrl, path, { ...options, method: 'PATCH', body }),

  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body' | 'method'>) =>
    request<T>(backendApiUrl, path, { ...options, method: 'PUT', body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(backendApiUrl, path, { ...options, method: 'DELETE' }),

  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(backendApiUrl, path, { ...options, method: 'GET' }),

  login: (email: string, password: string) =>
    request<BackendLoginResponse>(backendApiUrl, '/auth/login', {
      method: 'POST',
      body: { email, password }
    })
};
