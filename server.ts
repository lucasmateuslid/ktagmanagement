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

async function performGeocoding(address: string) {
  const userAgent = process.env.GEOCODING_USER_AGENT || 'KTagManagerPro/1.0';
  const googleKey = process.env.GEOCODING_GOOGLE_API_KEY;

  let usedFallback = false;
  let fallbacksCount = 0;

  // PASSO 1 -> Tentar OSM
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

  // Falha OSM -> aguardar 300ms -> ir para PASSO 2
  await delay(300);
  usedFallback = true;
  fallbacksCount++;
  console.log(`[GEOCODING] Google ativado como fallback #1. Motivo: OSM falhou ou não encontrou.`);

  // PASSO 2 -> Tentar Google
  if (googleKey) {
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
  } else {
    console.log(`[GEOCODING] Google ignorado (chave ausente).`);
  }

  throw new GeocodingError("Todos os provedores falharam");
}

async function performReverseGeocoding(lat: number, lng: number) {
  const userAgent = process.env.GEOCODING_USER_AGENT || 'KTagManagerPro/1.0';
  const googleKey = process.env.GEOCODING_GOOGLE_API_KEY;

  let usedFallback = false;
  let fallbacksCount = 0;

  // PASSO 1 -> Tentar OSM
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

  // Falha OSM -> aguardar 300ms -> ir para PASSO 2
  await delay(300);
  usedFallback = true;
  fallbacksCount++;
  console.log(`[GEOCODING] Google ativado como fallback #1. Motivo: OSM falhou ou não encontrou.`);

  // PASSO 2 -> Tentar Google
  if (googleKey) {
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
  } else {
    console.log(`[GEOCODING] Google ignorado (chave ausente).`);
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
      const { address } = req.body;
      if (!address) return res.status(400).json({ error: "Missing address" });

      const result = await performGeocoding(address);
      res.json(result);
    } catch (error: any) {
      console.error("Geocoding Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/reverse-geocode", async (req, res) => {
    try {
      const { lat, lng } = req.body;
      if (lat === undefined || lng === undefined) return res.status(400).json({ error: "Missing lat/lng" });

      const result = await performReverseGeocoding(lat, lng);
      res.json(result);
    } catch (error: any) {
      console.error("Reverse Geocoding Error:", error.message);
      res.status(500).json({ error: error.message });
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
