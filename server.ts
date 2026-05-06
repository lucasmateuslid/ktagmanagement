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

async function performGeocoding(address: string, providerPreference: 'osm' | 'google' = 'osm') {
  const userAgent = process.env.GEOCODING_USER_AGENT || 'KTagManagerPro/1.0';
  const googleKey = process.env.GEOCODING_GOOGLE_API_KEY;

  let usedFallback = false;
  let fallbacksCount = 0;

  const tryOSM = async () => {
    try {
      const start = Date.now();
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&addressdetails=1&limit=1&countrycodes=br`;
      const res = await fetchWithTimeout(url, { headers: { 'User-Agent': userAgent } });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const latency = Date.now() - start;
          console.log(`[GEOCODING] OSM respondeu com sucesso em ${latency}ms`);
          return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            displayName: data[0].display_name,
            provider: "osm",
            confidence: 1.0,
            usedFallback,
            raw: data[0]
          };
        }
      }
    } catch (e) {
      // OSM failed
    }
    return null;
  };

  const tryGoogle = async () => {
    if (!googleKey) {
      console.log(`[GEOCODING] Google ignorado (chave ausente).`);
      return null;
    }
    try {
      const start = Date.now();
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=br&language=pt-BR&key=${googleKey}`;
      const res = await fetchWithTimeout(url, {});
      if (res.ok) {
        const data = await res.json();
        if (data && data.status === 'OK' && data.results && data.results.length > 0) {
          const latency = Date.now() - start;
          console.log(`[GEOCODING] Google respondeu com sucesso em ${latency}ms. Total fallbacks: ${fallbacksCount}`);
          return {
            lat: data.results[0].geometry.location.lat,
            lng: data.results[0].geometry.location.lng,
            displayName: data.results[0].formatted_address,
            provider: "google",
            confidence: 1.0,
            usedFallback,
            raw: data.results[0]
          };
        }
      }
    } catch (e) {
      // Google failed
    }
    return null;
  };

  if (providerPreference === 'google') {
    const googleResult = await tryGoogle();
    if (googleResult) return googleResult;
    
    await delay(300);
    usedFallback = true;
    fallbacksCount++;
    console.log(`[GEOCODING] OSM ativado como fallback #1. Motivo: Google falhou ou não encontrou.`);
    
    const osmResult = await tryOSM();
    if (osmResult) return osmResult;
  } else {
    const osmResult = await tryOSM();
    if (osmResult) return osmResult;
    
    await delay(300);
    usedFallback = true;
    fallbacksCount++;
    console.log(`[GEOCODING] Google ativado como fallback #1. Motivo: OSM falhou ou não encontrou.`);
    
    const googleResult = await tryGoogle();
    if (googleResult) return googleResult;
  }

  throw new GeocodingError("Todos os provedores falharam");
}

async function performReverseGeocoding(lat: number, lng: number, providerPreference: 'osm' | 'google' = 'osm') {
  const userAgent = process.env.GEOCODING_USER_AGENT || 'KTagManagerPro/1.0';
  const googleKey = process.env.GEOCODING_GOOGLE_API_KEY;

  let usedFallback = false;
  let fallbacksCount = 0;

  const tryOSM = async () => {
    try {
      const start = Date.now();
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
      const res = await fetchWithTimeout(url, { headers: { 'User-Agent': userAgent } });
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          const latency = Date.now() - start;
          console.log(`[GEOCODING] OSM respondeu com sucesso em ${latency}ms`);
          return {
            lat: parseFloat(data.lat),
            lng: parseFloat(data.lon),
            displayName: data.display_name,
            provider: "osm",
            confidence: 1.0,
            usedFallback,
            raw: data
          };
        }
      }
    } catch (e) {
      // OSM failed
    }
    return null;
  };

  const tryGoogle = async () => {
    if (!googleKey) {
      console.log(`[GEOCODING] Google ignorado (chave ausente).`);
      return null;
    }
    try {
      const start = Date.now();
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=pt-BR&key=${googleKey}`;
      const res = await fetchWithTimeout(url, {});
      if (res.ok) {
        const data = await res.json();
        if (data && data.status === 'OK' && data.results && data.results.length > 0) {
          const latency = Date.now() - start;
          console.log(`[GEOCODING] Google respondeu com sucesso em ${latency}ms. Total fallbacks: ${fallbacksCount}`);
          return {
            lat: data.results[0].geometry.location.lat,
            lng: data.results[0].geometry.location.lng,
            displayName: data.results[0].formatted_address,
            provider: "google",
            confidence: 1.0,
            usedFallback,
            raw: data.results[0]
          };
        }
      }
    } catch (e) {
      // Google failed
    }
    return null;
  };

  if (providerPreference === 'google') {
    const googleResult = await tryGoogle();
    if (googleResult) return googleResult;
    
    await delay(300);
    usedFallback = true;
    fallbacksCount++;
    console.log(`[GEOCODING] OSM ativado como fallback #1. Motivo: Google falhou ou não encontrou.`);
    
    const osmResult = await tryOSM();
    if (osmResult) return osmResult;
  } else {
    const osmResult = await tryOSM();
    if (osmResult) return osmResult;
    
    await delay(300);
    usedFallback = true;
    fallbacksCount++;
    console.log(`[GEOCODING] Google ativado como fallback #1. Motivo: OSM falhou ou não encontrou.`);
    
    const googleResult = await tryGoogle();
    if (googleResult) return googleResult;
  }

  throw new GeocodingError("Todos os provedores falharam");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/geocode", async (req, res) => {
    try {
      const { address, providerPreference } = req.body;
      if (!address) return res.status(400).json({ error: "Missing address" });

      const result = await performGeocoding(address, providerPreference);
      res.json(result);
    } catch (error: any) {
      console.error("Geocoding Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/reverse-geocode", async (req, res) => {
    try {
      const { lat, lng, providerPreference } = req.body;
      if (lat === undefined || lng === undefined) return res.status(400).json({ error: "Missing lat/lng" });

      const result = await performReverseGeocoding(lat, lng, providerPreference);
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
