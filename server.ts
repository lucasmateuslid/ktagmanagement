import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";

class GeocodingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeocodingError";
  }
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

const RESERVED_SUBDOMAINS = new Set(['admin', 'api', 'www', 'mail', 'ftp', 'static', 'cdn', 'auth']);

function extractTenantFromHostname(hostname: string): string {
  if (!hostname) return 'default';
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')) {
    return 'localhost';
  }
  const parts = hostname.split('.');
  if (parts.length < 3) return 'default';
  return parts[0].toLowerCase();
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantId?: string;
      isAdminPanel?: boolean;
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

  // Bloqueia subdomínios reservados (exceto 'admin', que tem rota própria).
  if (RESERVED_SUBDOMAINS.has(tenantId) && tenantId !== 'admin') {
    return res.status(403).json({ error: `Subdomínio reservado: ${tenantId}` });
  }
  next();
}

async function startServer() {
  const app = express();
  // Cloud Run injeta PORT via env (padrão 8080). Em dev local fallback 3000.
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json());

  // Importante: trust proxy para que req.hostname respeite o X-Forwarded-Host
  // do Cloud Run / load balancer.
  app.set('trust proxy', true);

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

  app.post("/api/proxy", async (req, res) => {
    try {
      const { url, method, headers, body } = req.body;
      if (!url) return res.status(400).json({ error: "Missing 'url' in request body" });

      console.log(`[PROXY] Proxying request to: ${url}`);

      const safeHeaders: Record<string, string> = { ...headers };
      delete safeHeaders['host'];
      delete safeHeaders['content-length'];
      delete safeHeaders['connection'];
      delete safeHeaders['origin'];
      delete safeHeaders['referer'];
      delete safeHeaders['accept-encoding'];

      if (!safeHeaders['User-Agent'] && !safeHeaders['user-agent']) {
        safeHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      }

      const options: RequestInit = {
        method: method || 'GET',
        headers: safeHeaders,
      };

      if (body && method !== 'GET' && method !== 'HEAD') {
        options.body = typeof body === 'object' ? JSON.stringify(body) : body;
        if (!safeHeaders['Content-Type'] && !safeHeaders['content-type']) {
           if (typeof body === 'object') {
             safeHeaders['Content-Type'] = 'application/json';
           }
        }
      }

      const response = await fetch(url, options);
      
      const responseBody = await response.text();
      
      let parsedBody;
      try {
        parsedBody = JSON.parse(responseBody);
      } catch (e) {
        parsedBody = responseBody;
      }
      
      res.status(response.status).json(parsedBody);
    } catch (error: any) {
      console.error("[PROXY Error]", error.message);
      let errorMsg = error.message;
      if (typeof errorMsg === 'object') {
          try { errorMsg = JSON.stringify(errorMsg); } catch(e){}
      }
      res.status(500).json({ error: errorMsg, proxyError: true });
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

  // Webhook Receiver
  app.post("/api/melhorenvio/webhook", async (req, res) => {
    try {
      const signature = req.headers['x-me-signature'];
      // The secret should be validated if possible. In this environment, it requires the user's stored clientSecret,
      // but webhooks don't identify the tenant easily without a custom parameter in the URL.
      // For now, we will just log the webhook.
      
      const { order } = req.body;
      console.log('[MELHOR ENVIO Webhook] Evento Recebido:', order?.status, '| ID:', order?.id);
      
      // Emit event or update firebase (Not full implemented as we need to match to specific Shipment doc without knowing app config immediately here, but basic structure is ready)
      res.status(200).send('ok');
    } catch (error) {
      console.error("[MELHOR ENVIO Webhook] Error:", error);
      res.status(500).send('error');
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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
