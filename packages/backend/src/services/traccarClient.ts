// TraccarClient — wraps Traccar's internal REST API.
// Traccar v6 authenticates via JSESSIONID session cookies, not Bearer tokens.
// We create a session once (using the long-lived admin token) and re-authenticate on 401.

// Lidos lazily para garantir que dotenv já foi carregado quando o módulo é importado
const getTraccarBase = () => (process.env.TRACCAR_INTERNAL_URL || 'http://localhost:8082').replace(/\/$/, '');
const getTraccarToken = () => process.env.TRACCAR_ADMIN_TOKEN || '';

let sessionCookie = '';
let pendingAuth: Promise<void> | null = null;

async function authenticate(): Promise<void> {
  const token = getTraccarToken();
  if (!token) throw new Error('TRACCAR_ADMIN_TOKEN não configurado');

  const res = await fetch(`${getTraccarBase()}/api/session?token=${token}`);
  if (!res.ok) throw new Error(`Traccar auth falhou: ${res.status} ${await res.text()}`);

  // Node fetch exposes Set-Cookie as a single string or via getSetCookie (Node 18.14+)
  const raw: string =
    (res.headers as any).getSetCookie?.().join('; ') ?? res.headers.get('set-cookie') ?? '';

  const match = raw.match(/JSESSIONID=([^;,\s]+)/);
  if (!match) throw new Error('Traccar não retornou JSESSIONID após autenticação');

  sessionCookie = `JSESSIONID=${match[1]}`;
  console.log('[Traccar] sessão estabelecida');
}

async function ensureSession(): Promise<void> {
  if (sessionCookie) return;
  if (pendingAuth) return pendingAuth;
  pendingAuth = authenticate().finally(() => { pendingAuth = null; });
  return pendingAuth;
}

async function traccarFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  await ensureSession();

  const doReq = (): Promise<Response> =>
    fetch(`${getTraccarBase()}/api${path}`, {
      ...init,
      headers: {
        Cookie: sessionCookie,
        ...((init.headers ?? {}) as Record<string, string>),
      },
    });

  let res = await doReq();

  if (res.status === 401) {
    sessionCookie = '';
    await authenticate();
    res = await doReq();
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Traccar ${res.status} [${path}]: ${body}`);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
}

export async function traccarGet<T>(path: string): Promise<T> {
  return traccarFetch<T>(path);
}

export async function traccarPost<T>(path: string, body: unknown): Promise<T> {
  return traccarFetch<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function traccarDelete(path: string): Promise<void> {
  await traccarFetch<unknown>(path, { method: 'DELETE' });
}

// Inicializa a sessão no startup para que a primeira request não sofra latência de auth
export async function initTraccarSession(): Promise<void> {
  try {
    await authenticate();
  } catch (err: any) {
    console.warn('[Traccar] sessão inicial falhou (sem TRACCAR_ADMIN_TOKEN?):', err.message);
  }
}
