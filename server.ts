import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import dns from "node:dns/promises";
import net from "node:net";
// vite é devDependency e não é instalada no estágio runtime do Docker.
// Importação dinâmica abaixo, somente quando NODE_ENV !== 'production'.

class GeocodingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeocodingError";
  }
}

// ---------------------------------------------------------------
// SSRF GUARD — bloqueia URLs que apontam para metadata cloud,
// loopback, redes privadas RFC1918, CGNAT, link-local, IPv6 ULA, etc.
// Resolve o hostname antes de fetch para evitar DNS rebinding.
// ---------------------------------------------------------------
const PROXY_ALLOWED_HOSTS = new Set(
  (process.env.PROXY_ALLOWED_HOSTS || '')
    .split(',')
    .map(h => h.trim().toLowerCase())
    .filter(Boolean)
);

function isPrivateIPv4(ip: string): boolean {
  const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10) return true;                        // 10/8
  if (a === 127) return true;                       // loopback
  if (a === 0) return true;                         // 0.0.0.0/8
  if (a === 169 && b === 254) return true;          // link-local (metadata 169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true;          // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true;// 100.64/10 CGNAT
  if (a >= 224) return true;                        // multicast / reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const low = ip.toLowerCase();
  if (low === '::1' || low === '::') return true;
  if (low.startsWith('fe80:') || low.startsWith('fc') || low.startsWith('fd')) return true; // link-local + ULA
  if (low.startsWith('::ffff:')) {
    const v4 = low.slice('::ffff:'.length);
    if (net.isIPv4(v4)) return isPrivateIPv4(v4);
  }
  return false;
}

async function assertProxyTargetAllowed(rawUrl: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error('URL inválida.');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new Error(`Protocolo não permitido: ${u.protocol}`);
  }
  // Bloqueia credenciais embutidas (http://user:pass@host) — vetor SSRF clássico.
  if (u.username || u.password) {
    throw new Error('URL com credenciais embutidas não é permitida.');
  }
  const host = u.hostname.toLowerCase();

  // Allowlist via env (recomendado). Se definida, só hosts listados passam.
  if (PROXY_ALLOWED_HOSTS.size > 0) {
    const allowed = [...PROXY_ALLOWED_HOSTS].some(h =>
      host === h || host.endsWith('.' + h)
    );
    if (!allowed) throw new Error(`Host não permitido: ${host}`);
  }

  // Bloqueia metadata services explicitamente, mesmo se passou na allowlist.
  if (host === 'metadata.google.internal' || host === 'metadata' || host === 'instance-data' || host === 'metadata.goog') {
    throw new Error('Host de metadados bloqueado.');
  }

  // Se já é IP literal, validar diretamente.
  if (net.isIP(host)) {
    if (net.isIPv4(host) ? isPrivateIPv4(host) : isPrivateIPv6(host)) {
      throw new Error(`IP privado/reservado bloqueado: ${host}`);
    }
    return u;
  }

  // Resolve DNS e bloqueia se QUALQUER endereço resolver para faixa privada
  // (defesa contra DNS rebinding: o atacante pode hospedar A=pública e mudar
  // depois para 169.254.169.254).
  let addrs: Awaited<ReturnType<typeof dns.lookup>>;
  try {
    addrs = await dns.lookup(host, { all: true } as any) as any;
  } catch {
    throw new Error(`Falha ao resolver host: ${host}`);
  }
  const list = Array.isArray(addrs) ? addrs : [addrs];
  for (const a of list as Array<{ address: string; family: number }>) {
    const bad = a.family === 6 ? isPrivateIPv6(a.address) : isPrivateIPv4(a.address);
    if (bad) throw new Error(`Host resolve para IP privado/reservado (${a.address}).`);
  }
  return u;
}

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number = 5000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


// --- MULTI-PROVIDER GEOCODING LOGIC ---
const DEFAULT_GEOCODER_PREFS = {
  priority_order: ['geoapify', 'here', 'photon', 'google_maps', 'radar', 'openstreetmap'],
  providers: {
    geoapify: { enabled: false, api_key: null },
    here: { enabled: false, api_key: null },
    photon: { enabled: true, api_key: null },
    google_maps: { enabled: false, api_key: null },
    radar: { enabled: false, api_key: null },
    openstreetmap: { enabled: true, api_key: null }
  },
  confidence_threshold: 0.7,
  fallback_on_empty: true,
  fallback_on_low_confidence: true,
  country_filter: 'br',
  default_language: 'pt'
};

const USER_AGENT = process.env.GEOCODING_USER_AGENT || 'KTagManagerPro/1.0';

async function executeMultiProvider(type: 'forward' | 'reverse', queryOrCoords: any, prefs: any) {
  const preferences = prefs && prefs.priority_order ? prefs : DEFAULT_GEOCODER_PREFS;
  const order = preferences.priority_order || [];
  const providers = preferences.providers || {};
  const threshold = preferences.confidence_threshold || 0.7;

  let providers_tried = [];
  let fallback_used = false;
  let bestResult: any = null;

  for (let i = 0; i < order.length; i++) {
    const providerName = order[i];
    const config = providers[providerName];

    if (!config || !config.enabled) continue;

    providers_tried.push(providerName);
    if (providers_tried.length > 1) fallback_used = true;

    try {
      let result = null;
      const apiKey = config.api_key || '';

      if (type === 'forward') {
        const query = queryOrCoords;
        if (providerName === 'geoapify') {
          const res = await fetchWithTimeout(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&apiKey=${apiKey}`, {});
          if (res.ok) {
            const data = await res.json();
            if (data.features && data.features.length > 0) {
              const f = data.features[0].properties;
              result = { lat: f.lat, lng: f.lon, address: f.formatted, confidence: f.rank?.confidence || 1.0, raw: data.features[0] };
            }
          }
        } else if (providerName === 'here') {
          const res = await fetchWithTimeout(`https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(query)}&apiKey=${apiKey}`, {});
          if (res.ok) {
            const data = await res.json();
            if (data.items && data.items.length > 0) {
              result = { lat: data.items[0].position.lat, lng: data.items[0].position.lng, address: data.items[0].address.label, confidence: 1.0, raw: data.items[0] };
            }
          }
        } else if (providerName === 'photon') {
          const res = await fetchWithTimeout(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`, {});
          if (res.ok) {
            const data = await res.json();
            if (data.features && data.features.length > 0) {
              const f = data.features[0];
              const addrItems = [f.properties.street, f.properties.housenumber, f.properties.city, f.properties.state].filter(Boolean);
              const addrStr = addrItems.join(', ') || f.properties.name;
              result = { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], address: addrStr, confidence: 1.0, raw: f };
            }
          }
        } else if (providerName === 'google_maps' || providerName === 'google') {
          const keyToUse = apiKey || process.env.GEOCODING_GOOGLE_API_KEY;
          const res = await fetchWithTimeout(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=br&language=pt-BR&key=${keyToUse}`, {});
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'OK' && data.results && data.results.length > 0) {
              const locType = data.results[0].geometry?.location_type;
              let conf = 1.0;
              if (locType === 'ROOFTOP') conf = 1.0;
              else if (locType === 'RANGE_INTERPOLATED') conf = 0.9;
              else if (locType === 'GEOMETRIC_CENTER') conf = 0.7;
              else if (locType === 'APPROXIMATE') conf = 0.5;

              result = { lat: data.results[0].geometry.location.lat, lng: data.results[0].geometry.location.lng, address: data.results[0].formatted_address, confidence: conf, raw: data.results[0] };
            }
          }
        } else if (providerName === 'radar') {
          const res = await fetchWithTimeout(`https://api.radar.io/v1/geocode/forward?query=${encodeURIComponent(query)}`, { headers: { 'Authorization': apiKey } });
          if (res.ok) {
            const data = await res.json();
            if (data.addresses && data.addresses.length > 0) {
              const confStr = data.addresses[0].confidence;
              let confNum = 0.5;
              if (confStr === 'exact') confNum = 1.0;
              else if (confStr === 'interpolated') confNum = 0.8;
              result = { lat: data.addresses[0].latitude, lng: data.addresses[0].longitude, address: data.addresses[0].formattedAddress, confidence: confNum, raw: data.addresses[0] };
            }
          }
        } else if (providerName === 'openstreetmap' || providerName === 'osm') {
          const res = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&countrycodes=br`, { headers: { 'User-Agent': USER_AGENT } });
          if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
              // Nominatim doesn't have native confidence but importance
              const bestMatch = data[0];
              const parsedConfidence = bestMatch.importance ? Math.min(1.0, (bestMatch.importance * 1.5) + 0.3) : 0.8;
              result = { lat: parseFloat(bestMatch.lat), lng: parseFloat(bestMatch.lon), address: bestMatch.display_name, confidence: parsedConfidence, raw: bestMatch };
            }
          }
        }
      } else {
        const { lat, lng } = queryOrCoords;
        if (providerName === 'geoapify') {
          const res = await fetchWithTimeout(`https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${apiKey}`, {});
          if (res.ok) {
            const data = await res.json();
            if (data.features && data.features.length > 0) {
              const f = data.features[0].properties;
              result = { lat: f.lat, lng: f.lon, address: f.formatted, confidence: f.rank?.confidence || 1.0, raw: data.features[0] };
            }
          }
        } else if (providerName === 'here') {
          const res = await fetchWithTimeout(`https://revgeocode.search.hereapi.com/v1/revgeocode?at=${lat},${lng}&apiKey=${apiKey}`, {});
          if (res.ok) {
            const data = await res.json();
            if (data.items && data.items.length > 0) {
              result = { lat: data.items[0].position.lat, lng: data.items[0].position.lng, address: data.items[0].address.label, confidence: 1.0, raw: data.items[0] };
            }
          }
        } else if (providerName === 'photon') {
          const res = await fetchWithTimeout(`https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}`, {});
          if (res.ok) {
            const data = await res.json();
            if (data.features && data.features.length > 0) {
              const f = data.features[0];
              const addrItems = [f.properties.street, f.properties.housenumber, f.properties.city, f.properties.state].filter(Boolean);
              const addr = addrItems.join(', ') || f.properties.name;
              result = { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], address: addr, confidence: 1.0, raw: f };
            }
          }
        } else if (providerName === 'google_maps' || providerName === 'google') {
          const keyToUse = apiKey || process.env.GEOCODING_GOOGLE_API_KEY;
          const res = await fetchWithTimeout(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=pt-BR&key=${keyToUse}`, {});
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'OK' && data.results && data.results.length > 0) {
              result = { lat: data.results[0].geometry.location.lat, lng: data.results[0].geometry.location.lng, address: data.results[0].formatted_address, confidence: 1.0, raw: data.results[0] };
            }
          }
        } else if (providerName === 'radar') {
          const res = await fetchWithTimeout(`https://api.radar.io/v1/geocode/reverse?coordinates=${lat},${lng}`, { headers: { 'Authorization': apiKey } });
          if (res.ok) {
            const data = await res.json();
            if (data.addresses && data.addresses.length > 0) {
              result = { lat: data.addresses[0].latitude, lng: data.addresses[0].longitude, address: data.addresses[0].formattedAddress, confidence: 1.0, raw: data.addresses[0] };
            }
          }
        } else if (providerName === 'openstreetmap' || providerName === 'osm') {
          const res = await fetchWithTimeout(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`, { headers: { 'User-Agent': USER_AGENT } });
          if (res.ok) {
            const data = await res.json();
            if (data && data.display_name) {
              result = { lat: parseFloat(data.lat), lng: parseFloat(data.lon), address: data.display_name, confidence: 1.0, raw: data };
            }
          }
        }
      }

      if (result) {
        if (!bestResult || result.confidence > bestResult.result.confidence) {
          bestResult = {
            provider_used: providerName,
            providers_tried,
            fallback_used,
            query: type === 'forward' ? queryOrCoords : `${queryOrCoords.lat},${queryOrCoords.lng}`,
            result
          };
        }

        if (result.confidence >= threshold || !preferences.fallback_on_low_confidence) {
          return {
            provider_used: providerName,
            providers_tried,
            fallback_used,
            query: type === 'forward' ? queryOrCoords : `${queryOrCoords.lat},${queryOrCoords.lng}`,
            result
          };
        }
      }
    } catch (e: any) {
      console.warn(`[GEOCODING] Provider ${providerName} failed: ${e.message}`);
    }
  }

  if (bestResult) {
    return bestResult;
  }

  throw new GeocodingError("Todos os provedores falharam: " + JSON.stringify(providers_tried));
}

async function performGeocoding(address: string, geocoderPreferences: any) {
  return await executeMultiProvider('forward', address, geocoderPreferences);
}

async function performReverseGeocoding(lat: number, lng: number, geocoderPreferences: any) {
  return await executeMultiProvider('reverse', { lat, lng }, geocoderPreferences);
}

// ---------------------------------------------------------------
// Tenant resolution middleware (Fase 5)
// Extrai o tenant a partir do hostname (subdomínio). Em dev (localhost),
// aceita header X-Tenant-Id ou query ?tenant=. Não consulta Firestore — apenas
// popula req.tenantId. Rotas que precisam de credenciais por-tenant podem
// fazer o lookup adicional sob demanda (cache server-side recomendado).
// ---------------------------------------------------------------

const RESERVED_SUBDOMAINS = new Set(['admin', 'api', 'www', 'mail', 'ftp', 'static', 'cdn', 'auth', 'lock']);
const APEX_TENANT = '__apex__';

function extractTenantFromHostname(hostname: string): string {
  if (!hostname) return APEX_TENANT;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')) {
    return 'localhost';
  }
  const parts = hostname.split('.');
  if (parts.length < 3) return APEX_TENANT;
  return parts[0].toLowerCase();
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantId?: string;
      isAdminPanel?: boolean;
      isApex?: boolean;
    }
  }
}

function resolveTenant(req: express.Request, res: express.Response, next: express.NextFunction) {
  const headerTenant = (req.headers['x-tenant-id'] as string | undefined)?.trim().toLowerCase();
  const queryTenant = (req.query.tenant as string | undefined)?.trim().toLowerCase();
  const hostTenant = extractTenantFromHostname(req.hostname || (req.headers.host as string) || '');

  let tenantId = hostTenant;
  if (tenantId === 'localhost') {
    tenantId = headerTenant || queryTenant || (process.env.DEFAULT_DEV_TENANT || 'dev-tenant');
  }

  req.tenantId = tenantId;
  req.isAdminPanel = tenantId === 'admin';
  req.isApex = tenantId === APEX_TENANT;

  // Apex tem tratamento próprio (serve apex.html / placeholder).
  // 'lock' deveria ser desviado pelo DNS para uma instância externa; chegando
  // aqui, retorna 403 explícito (defesa em profundidade).
  if (req.isApex) {
    return next();
  }
  if (RESERVED_SUBDOMAINS.has(tenantId) && tenantId !== 'admin') {
    return res.status(403).json({ error: `Subdomínio reservado: ${tenantId}` });
  }
  next();
}

async function startServer() {
  const app = express();
  // Cloud Run injeta PORT via env (padrão 8080). Em dev local fallback 4000.
  const PORT = Number(process.env.PORT) || 4000;

  // trust proxy = 2: Cloudflare (1) + Cloud Run frontend (2). Necessário para
  // req.ip refletir o cliente real (rate-limit) e req.hostname refletir o
  // visitor hostname (tenant resolution). Spoof de XFF pelo client é mitigado
  // porque o limite é numérico, não 'true'.
  app.set('trust proxy', 2);

  // ---------- SECURITY HEADERS ----------
  // CSP relativamente permissiva para acomodar Firebase + Leaflet + mapas;
  // refinar conforme o app evoluir. HSTS habilitado em produção.
  const isProd = process.env.NODE_ENV === 'production';
  app.use(helmet({
    contentSecurityPolicy: false, // SPA dinâmica; ativar CSP estrita exige nonces
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: isProd ? { maxAge: 15552000, includeSubDomains: true, preload: false } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  // ---------- ORIGIN SECRET (Cloudflare → Cloud Run) ----------
  // Cloudflare termina TLS pra ktagfinder.app/*.ktagfinder.app e injeta o
  // header X-Origin-Secret via Transform Rule. Tudo que chegar SEM o header
  // (ex: alguém batendo direto em *.run.app) recebe 403. Fail-closed se
  // CF_ORIGIN_SECRET não estiver configurado em produção.
  if (isProd) {
    const expectedSecret = process.env.CF_ORIGIN_SECRET || '';
    if (!expectedSecret) {
      console.error('[ORIGIN] CF_ORIGIN_SECRET não configurado em produção — bloqueando todas as requests.');
    }
    app.use((req, res, next) => {
      if (!expectedSecret) return res.status(503).json({ error: 'origin not configured' });
      const received = req.headers['x-origin-secret'];
      if (typeof received !== 'string' || received.length !== expectedSecret.length) {
        return res.status(403).json({ error: 'forbidden' });
      }
      let diff = 0;
      for (let i = 0; i < expectedSecret.length; i++) {
        diff |= received.charCodeAt(i) ^ expectedSecret.charCodeAt(i);
      }
      if (diff !== 0) return res.status(403).json({ error: 'forbidden' });
      next();
    });
  }

  // ---------- CORS ----------
  // Default: aceita apenas ktagfinder.app e seus subdomínios em produção.
  // Localhost liberado em dev. Override via CORS_ALLOW_ALL=true (NÃO RECOMENDADO).
  const ALLOWED_ORIGIN_PATTERN = /^https:\/\/([a-z0-9-]+\.)?ktagfinder\.app$/;
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // server-to-server / curl
      if (process.env.CORS_ALLOW_ALL === 'true') return cb(null, true);
      if (ALLOWED_ORIGIN_PATTERN.test(origin)) return cb(null, true);
      if (!isProd && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
        return cb(null, true);
      }
      return cb(new Error(`Origin não permitida: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE'],
  }));

  // ---------- BODY LIMITS ----------
  // 100kB padrão; suficiente para JSON de geocoding/tracking. Webhooks com
  // payload maior devem ser configurados via rota dedicada.
  app.use(express.json({ limit: '100kb' }));

  // ---------- RATE LIMITING ----------
  // Limites por IP (com trust proxy = 2 → Cloudflare + Cloud Run). Aplica
  // somente a /api/*; assets estáticos não são limitados.
  const apiLimiter = rateLimit({
    windowMs: 60_000,
    limit: 120, // 120 req/min por IP
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Muitas requisições. Tente novamente em instantes.' },
  });
  const sensitiveLimiter = rateLimit({
    windowMs: 60_000,
    limit: 20, // proxy/track: 20/min
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Rate limit excedido neste endpoint.' },
  });
  app.use('/api/', apiLimiter);

  app.use(resolveTenant);

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", tenantId: req.tenantId });
  });

  app.post("/api/geocode", async (req, res) => {
    try {
      const { address, geocoderPreferences } = req.body;
      if (!address) return res.status(400).json({ error: "Missing address" });

      const result = await performGeocoding(address, geocoderPreferences);
      res.json(result);
    } catch (error: any) {
      console.error("Geocoding Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/reverse-geocode", async (req, res) => {
    try {
      const { lat, lng, geocoderPreferences } = req.body;
      if (lat === undefined || lng === undefined) return res.status(400).json({ error: "Missing lat/lng" });

      const result = await performReverseGeocoding(lat, lng, geocoderPreferences);
      res.json(result);
    } catch (error: any) {
      console.error("Reverse Geocoding Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // PROXY: hardenizado contra SSRF.
  //   - exige allowlist (PROXY_ALLOWED_HOSTS) OU restringe a hosts não-privados
  //   - bloqueia metadata services, loopback, RFC1918, link-local, ULA
  //   - resolve DNS antes do fetch para mitigar DNS rebinding
  //   - permite apenas headers seguros do client (allowlist)
  //   - timeout de 15s, limita tamanho da resposta repassada
  const ALLOWED_PROXY_HEADERS = new Set([
    'authorization', 'content-type', 'accept', 'apikey', 'api_token',
    'timestamp', 'user-agent', 'x-api-key',
  ]);
  app.post("/api/proxy", sensitiveLimiter, async (req, res) => {
    try {
      let { url, method, headers, body } = req.body || {};
      const injectAuth = (req.body || {}).injectAuth;

      // K-TAG: credenciais centralizadas — o cliente envia apenas injectAuth:'ktag'
      // (sem url nem Authorization). O servidor resolve a URL e injeta o Basic Auth.
      if (injectAuth === 'ktag') {
        url = process.env.KTAG_API_URL || '';
        if (!url) {
          return res.status(500).json({ error: 'K-TAG não configurada no servidor (KTAG_API_URL ausente).' });
        }
      }

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "Missing 'url' in request body" });
      }
      if (url.length > 2048) {
        return res.status(400).json({ error: "URL muito longa." });
      }

      let target: URL;
      try {
        target = await assertProxyTargetAllowed(url);
      } catch (e: any) {
        console.warn('[PROXY] target rejected:', e.message, 'url=', url);
        return res.status(403).json({ error: `Proxy bloqueado: ${e.message}` });
      }

      const safeMethod = (typeof method === 'string' && /^(GET|POST|PUT|PATCH|DELETE|HEAD)$/i.test(method))
        ? method.toUpperCase() : 'GET';

      // Allowlist de headers do client — nada de Host/Cookie/etc.
      const safeHeaders: Record<string, string> = {};
      if (headers && typeof headers === 'object') {
        for (const [k, v] of Object.entries(headers)) {
          const lk = k.toLowerCase();
          if (ALLOWED_PROXY_HEADERS.has(lk) && typeof v === 'string') {
            safeHeaders[k] = v;
          }
        }
      }
      if (!safeHeaders['User-Agent'] && !safeHeaders['user-agent']) {
        safeHeaders['User-Agent'] = process.env.PROXY_USER_AGENT || 'KTagManagerPro-Proxy/1.0';
      }
      // K-TAG: injeta Basic Auth a partir do env (cliente nunca vê as credenciais).
      if (injectAuth === 'ktag') {
        const u = process.env.KTAG_API_USER || '';
        const p = process.env.KTAG_API_PASS || '';
        safeHeaders['Authorization'] = 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');
      }

      const options: RequestInit = {
        method: safeMethod,
        headers: safeHeaders,
        redirect: 'manual', // não seguir redirects automáticos — eles podem virar SSRF
      };
      if (body && safeMethod !== 'GET' && safeMethod !== 'HEAD') {
        options.body = typeof body === 'object' ? JSON.stringify(body) : String(body);
        if (!safeHeaders['Content-Type'] && !safeHeaders['content-type'] && typeof body === 'object') {
          safeHeaders['Content-Type'] = 'application/json';
        }
      }

      const ctl = new AbortController();
      const tmo = setTimeout(() => ctl.abort(), 15_000);
      let response: Response;
      try {
        response = await fetch(target.toString(), { ...options, signal: ctl.signal });
      } finally {
        clearTimeout(tmo);
      }

      // 3xx vira erro explícito (não seguimos redirects para evitar SSRF via Location).
      if (response.status >= 300 && response.status < 400) {
        return res.status(502).json({ error: 'Resposta redirecionada — proxy não segue redirects.', upstreamStatus: response.status });
      }

      // Limita o body repassado a 5MB para não explodir memória.
      const buf = await response.arrayBuffer();
      if (buf.byteLength > 5 * 1024 * 1024) {
        return res.status(502).json({ error: 'Resposta upstream muito grande.' });
      }
      const responseBody = Buffer.from(buf).toString('utf8');
      let parsedBody: any;
      try { parsedBody = JSON.parse(responseBody); } catch { parsedBody = responseBody; }
      res.status(response.status).json(parsedBody);
    } catch (error: any) {
      const msg = error?.name === 'AbortError' ? 'Timeout no upstream.' : (error?.message || 'Proxy error');
      console.error("[PROXY Error]", msg);
      res.status(502).json({ error: msg, proxyError: true });
    }
  });

  app.post("/api/track", async (req, res) => {
    try {
      const { code, apiKey } = req.body;
      console.log("Request body:", JSON.stringify({ code, apiKey: apiKey ? '***' : 'missing' }, null, 2));

      if (!code || !apiKey) {
        return res.status(400).json({ error: "Missing code or apiKey" });
      }

      const response = await fetch('https://api-labs.wonca.com.br/wonca.labs.v1.LabsService/Track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Apikey ${apiKey}`
        },
        body: JSON.stringify({ code })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return res.status(response.status).json({ 
          error: errorData.message || `Erro na requisição: ${response.status} ${response.statusText}` 
        });
      }

      const data = await response.json();
      console.log("API response:", JSON.stringify(data, null, 2));
      
      if (data.json) {
        try {
          const parsedJson = JSON.parse(data.json);
          res.json({ 
            ...parsedJson, 
            events: parsedJson.eventos, 
            carrier: data.carrier 
          });
        } catch (e) {
          console.error("Error parsing nested JSON:", e);
          res.json(data);
        }
      } else {
        res.json(data);
      }
    } catch (error: any) {
      console.error("Tracking API error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // --- INÍCIO ENDPOINTS MELHOR ENVIO --- //
  
  // Função helper interna para requisições do Melhor Envio
  const performMeRequest = async (path: string, payload: any, token: string, method = 'POST', environment: string = 'sandbox') => {
    const baseUrl = environment === 'production' ? 'https://melhorenvio.com.br' : 'https://sandbox.melhorenvio.com.br';
    
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        'User-Agent': 'KTagManagerPro (paulo.lucalikeboss@gmail.com)'
      },
      body: payload ? JSON.stringify(payload) : undefined
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let msg = errorData.message || errorData.error || `Erro da API ${response.status}`;
        if (typeof msg === 'object') msg = JSON.stringify(msg);

        throw { 
          status: response.status, 
          message: msg,
          data: errorData 
        };
    }

    return await response.json();
  };

  app.post("/api/melhorenvio/oauth/exchange", async (req, res) => {
    try {
      const { code, clientId, clientSecret, redirectUri, environment } = req.body;
      const baseUrl = environment === 'production' ? 'https://melhorenvio.com.br' : 'https://sandbox.melhorenvio.com.br';
      
      const response = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'KTagManagerPro (paulo.lucalikeboss@gmail.com)'
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code
        })
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({ error: data.message || data.error || "Failed to exchange token", details: data });
      }

      res.json(data);
    } catch (error: any) {
      console.error("[MELHOR ENVIO] Exceção no exchange:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/melhorenvio/oauth/refresh", async (req, res) => {
    try {
      const { refreshToken, clientId, clientSecret, environment } = req.body;
      const baseUrl = environment === 'production' ? 'https://melhorenvio.com.br' : 'https://sandbox.melhorenvio.com.br';
      
      const response = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'KTagManagerPro (paulo.lucalikeboss@gmail.com)'
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret
        })
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({ error: data.message || data.error || "Failed to refresh token", details: data });
      }

      res.json(data);
    } catch (error: any) {
      console.error("[MELHOR ENVIO] Exceção no refresh:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/melhorenvio/calculate", async (req, res) => {
    try {
      const { from, to, products, token, options, services, environment } = req.body;
      if (!from || !to || !products || !token) {
        return res.status(400).json({ error: "Missing from, to, products or token" });
      }
      
      const payload: any = { from, to, products };
      if (options) payload.options = options;
      if (services) payload.services = services;

      const data = await performMeRequest('/api/v2/me/shipment/calculate', payload, token, 'POST', environment);
      res.json(data);
    } catch (error: any) {
      console.error("[MELHOR ENVIO] Exceção:", error);
      res.status(error.status || 500).json({ 
        error: error.message || "Internal server error", 
        details: error.data 
      });
    }
  });

  app.post("/api/melhorenvio/companies", async (req, res) => {
    try {
      const { token, environment } = req.body;
      if (!token) return res.status(400).json({ error: "Missing token" });

      const data = await performMeRequest('/api/v2/me/shipment/companies', null, token, 'GET', environment);
      res.json(data);
    } catch (error: any) {
      console.error("[MELHOR ENVIO Companies] Error:", error);
      res.status(error.status || 500).json({ error: error.message || "Internal server error", details: error.data });
    }
  });

  app.post("/api/melhorenvio/cart", async (req, res) => {
    try {
      const { 
        service, from, to, products, volumes, options, token, environment
      } = req.body;
      
      if (!token) return res.status(400).json({ error: "Missing token" });

      const data = await performMeRequest('/api/v2/me/cart', {
        service, from, to, products, volumes, options
      }, token, 'POST', environment);
      
      res.json(data);
    } catch (error: any) {
      console.error("[MELHOR ENVIO Cart] Error:", error);
      res.status(error.status || 500).json({ error: error.message || "Internal server error", details: error.data });
    }
  });

  app.post("/api/melhorenvio/checkout", async (req, res) => {
    try {
      const { orders, token, environment } = req.body;
      if (!token) return res.status(400).json({ error: "Missing token" });

      const data = await performMeRequest('/api/v2/me/shipment/checkout', { orders: orders || [] }, token, 'POST', environment);
      res.json(data);
    } catch (error: any) {
      console.error("[MELHOR ENVIO Checkout] Error:", error);
      res.status(error.status || 500).json({ error: error.message || "Internal server error", details: error.data });
    }
  });

  app.post("/api/melhorenvio/generate", async (req, res) => {
    try {
      const { orders, token, environment } = req.body;
      if (!token || !orders) return res.status(400).json({ error: "Missing token or orders" });

      const data = await performMeRequest('/api/v2/me/shipment/generate', { orders }, token, 'POST', environment);
      res.json(data);
    } catch (error: any) {
      console.error("[MELHOR ENVIO Generate] Error:", error);
      res.status(error.status || 500).json({ error: error.message || "Internal server error", details: error.data });
    }
  });

  app.post("/api/melhorenvio/print", async (req, res) => {
    try {
      const { orders, token, mode, environment } = req.body;
      if (!token || !orders) return res.status(400).json({ error: "Missing token or orders" });

      const data = await performMeRequest('/api/v2/me/shipment/print', { mode: mode || 'public', orders }, token, 'POST', environment);
      res.json(data);
    } catch (error: any) {
      console.error("[MELHOR ENVIO Print] Error:", error);
      res.status(error.status || 500).json({ error: error.message || "Internal server error", details: error.data });
    }
  });

  app.post("/api/melhorenvio/tracking", async (req, res) => {
    try {
      const { orders, token, environment } = req.body;
      if (!token || !orders) return res.status(400).json({ error: "Missing token or orders" });

      const data = await performMeRequest('/api/v2/me/shipment/tracking', { orders }, token, 'POST', environment);
      res.json(data);
    } catch (error: any) {
      console.error("[MELHOR ENVIO Tracking] Error:", error);
      res.status(error.status || 500).json({ error: error.message || "Internal server error", details: error.data });
    }
  });

  app.post("/api/melhorenvio/cancel", async (req, res) => {
    try {
      const { orders, token, environment } = req.body;
      if (!token || !orders) return res.status(400).json({ error: "Missing token or orders" });

      const data = await performMeRequest('/api/v2/me/shipment/cancel', { orders }, token, 'POST', environment);
      res.json(data);
    } catch (error: any) {
      console.error("[MELHOR ENVIO Cancel] Error:", error);
      res.status(error.status || 500).json({ error: error.message || "Internal server error", details: error.data });
    }
  });

  app.post("/api/melhorenvio/sync-tracking", async (req, res) => {
    try {
      const { shipments, token, environment } = req.body;
      if (!token || !shipments || !Array.isArray(shipments)) return res.status(400).json({ error: "Missing token or shipments" });

      const updates: any[] = [];
      const ordersToTrack = shipments.filter(s => s.melhorEnvio?.orderId && s.status === 'enviado').map(s => s.melhorEnvio.orderId);

      if (ordersToTrack.length > 0) {
        const data = await performMeRequest('/api/v2/me/shipment/tracking', { orders: ordersToTrack }, token, 'POST', environment);
        
        for (const [orderId, trackingInfo] of Object.entries(data as any)) {
          const tInfo = trackingInfo as any;
          if (tInfo && tInfo.status) {
            // Verifica o status do Melhor Envio: "delivered"
            if (tInfo.status === 'delivered') {
              updates.push({
                orderId,
                status: 'entregue',
                melhorEnvioStatus: tInfo.status,
                trackingHistory: tInfo.tracking
              });
            } else if (tInfo.status === 'canceled') {
              updates.push({
                orderId,
                status: 'cancelado',
                melhorEnvioStatus: tInfo.status,
                trackingHistory: tInfo.tracking
              });
            }
          }
        }
      }

      res.json({ success: true, updates });
    } catch (error: any) {
      console.error("[MELHOR ENVIO Sync Tracking] Error:", error);
      res.status(error.status || 500).json({ error: error.message || "Internal server error", details: error.data });
    }
  });

  // Webhook Receiver.
  // Why: webhooks são endpoints públicos — sem validação de assinatura, qualquer
  // um pode forjar eventos. Exigimos HMAC SHA-256 com MELHOR_ENVIO_WEBHOOK_SECRET.
  // Se o secret não estiver configurado, o endpoint retorna 503 (fail-closed)
  // em vez de aceitar tudo.
  const meWebhookSecret = process.env.MELHOR_ENVIO_WEBHOOK_SECRET || '';
  app.post(
    "/api/melhorenvio/webhook",
    // Captura raw body para validar HMAC; precisa ANTES de express.json()
    express.raw({ type: '*/*', limit: '256kb' }),
    async (req, res) => {
      try {
        if (!meWebhookSecret) {
          console.error('[MELHOR ENVIO Webhook] MELHOR_ENVIO_WEBHOOK_SECRET não configurado — rejeitando.');
          return res.status(503).send('webhook secret not configured');
        }
        const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
        const signature = String(req.headers['x-me-signature'] || '');
        if (!signature) return res.status(401).send('missing signature');

        const { createHmac, timingSafeEqual } = await import('node:crypto');
        const expected = createHmac('sha256', meWebhookSecret).update(rawBody).digest('hex');
        const a = Buffer.from(expected, 'hex');
        let b: Buffer;
        try { b = Buffer.from(signature, 'hex'); } catch { return res.status(401).send('invalid signature format'); }
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return res.status(401).send('invalid signature');
        }

        let payload: any = null;
        try { payload = JSON.parse(rawBody.toString('utf8')); } catch { /* ignore */ }
        const order = payload?.order;
        console.log('[MELHOR ENVIO Webhook] verified:', order?.status, '| ID:', order?.id);

        // Processamento de evento — fora de escopo desta auditoria; manter no-op
        // por ora, mas a assinatura foi validada.
        res.status(200).send('ok');
      } catch (error) {
        console.error("[MELHOR ENVIO Webhook] Error:", error);
        res.status(500).send('error');
      }
    }
  );

  // Apex placeholder: quando o Host bate no domínio raiz (ktagfinder.app),
  // serve um HTML estático leve em vez do SPA. Subdomínios continuam servindo
  // o bundle React normalmente.
  const apexHtmlProd = path.join(process.cwd(), 'dist', 'apex.html');
  const apexHtmlDev = path.join(process.cwd(), 'public', 'apex.html');
  app.use((req, res, next) => {
    if (!req.isApex) return next();
    if (req.method !== 'GET') return next();
    if (req.path !== '/' && req.path !== '/index.html') return next();
    const file = process.env.NODE_ENV === 'production' ? apexHtmlProd : apexHtmlDev;
    return res.sendFile(file);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get(/.*/, (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
