
import { storage } from './storage';
import { Tag, KTagLocationResult, KTagBatteryInfo } from '../types';

const BASE_URL = 'https://tags.traqcare.com/api';
const REQUEST_TIMEOUT = 20000; // Aumentado para 20s

/**
 * UTILS
 */

// Battery Adapter (TraqCare → K-TAG)
const batteryToInfo = (battery?: number): KTagBatteryInfo => {
    // 0 pode ser bateria crítica ou desconhecida dependendo do firmware, tratando como crítica
    switch (battery) {
        case 3: return { level: 100, label: 'Alto', color: '#10b981' }; // Green
        case 2: return { level: 60, label: 'Médio', color: '#eab308' }; // Yellow
        case 1: return { level: 30, label: 'Baixo', color: '#f97316' }; // Orange
        case 0: return { level: 10, label: 'Crítico', color: '#ef4444' }; // Red
        default: return { level: 0, label: 'N/A', color: '#71717a' };
    }
};

// Abortable fetch (timeout safe)
const fetchWithTimeout = async (url: string, options: RequestInit = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw new Error('Timeout: O servidor demorou muito para responder.');
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
};

// Proxy-aware URL resolver
const resolveUrl = async (path: string, params?: Record<string, string>) => {
    const settings = await storage.getSettings();
    const query = params ? '?' + new URLSearchParams(params).toString() : '';

    // Se houver proxy configurado, a URL base é passada no body do proxy, 
    // mas aqui construímos a URL alvo final
    const targetBase = BASE_URL; 
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    
    // Se estiver usando Proxy do Firebase (customProxyUrl), a URL final é montada dentro da função getHeaders/fetch
    // Aqui retornamos a URL Alvo Completa para o payload do Proxy
    return `${targetBase}${cleanPath}${query}`;
};

// Headers factory
// Doc: timestamp (long) -> Usually milliseconds in Java/C# backends
const getHeaders = async () => {
    const settings = await storage.getSettings();
    return {
        'Content-Type': 'application/json',
        'api_token': settings.traqcareToken || '',
        'timestamp': Date.now().toString(), // Envia em Milissegundos (long)
    };
};

// Universal Response Parser
const unwrapResponse = async <T>(response: Response): Promise<T | null> => {
    try {
        const text = await response.text();
        if (!text) return null;

        let json;
        try {
            json = JSON.parse(text);
        } catch {
            console.error('TraqCare Non-JSON Response:', text.substring(0, 100));
            return null;
        }

        // Verifica formato padrão { statusCode, message, data }
        if (json && typeof json === 'object') {
            if ('statusCode' in json && json.statusCode !== 200) {
                console.warn('TraqCare API Error:', json.message || json.problem || 'Unknown Error');
                throw new Error(json.message || `Erro API: ${json.statusCode}`);
            }
            // Retorna 'data' se existir, ou o próprio json se não seguir o envelope padrão
            return json.data !== undefined ? json.data : json;
        }

        return json as T;
    } catch (err) {
        console.error('TraqCare Parse Error:', err);
        throw err;
    }
};

/**
 * SERVICE
 */

export const xadtagService = {

    /**
     * PATCH /tag — Activate device
     * Body: List of IDs to activate
     */
    activate: async (tag: Tag): Promise<boolean> => {
        if (!tag.traqcareId) return false;

        try {
            const settings = await storage.getSettings();
            const targetUrl = await resolveUrl('/tag');
            const headers = await getHeaders();
            const body = JSON.stringify([tag.traqcareId]); // Array de IDs conforme padrão comum

            let response;

            if (settings.customProxyUrl) {
                // Via Proxy
                response = await fetchWithTimeout(settings.customProxyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: targetUrl,
                        method: 'PATCH',
                        headers,
                        body
                    })
                });
            } else {
                // Direto (pode falhar por CORS)
                response = await fetchWithTimeout(targetUrl, {
                    method: 'PATCH',
                    headers,
                    body
                });
            }

            const result = await unwrapResponse<any>(response);
            return !!result;
        } catch (err) {
            console.error('XADTAG Activation Error:', err);
            return false;
        }
    },

    /**
     * GET /tag — Get AirTag by ID
     * Doc: Get AirTag by ID
     */
    fetchLocation: async (tag: Tag): Promise<KTagLocationResult[]> => {
        if (!tag.traqcareId) return [];

        try {
            const settings = await storage.getSettings();
            // Tenta usar 'id' no singular primeiro
            const targetUrl = await resolveUrl('/tag', { id: tag.traqcareId });
            const headers = await getHeaders();

            let response;

            if (settings.customProxyUrl) {
                response = await fetchWithTimeout(settings.customProxyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: targetUrl,
                        method: 'GET',
                        headers
                    })
                });
            } else {
                response = await fetchWithTimeout(targetUrl, { method: 'GET', headers });
            }

            if (!response.ok) {
                console.warn(`TraqCare Location HTTP Error: ${response.status}`);
                return [];
            }

            const data = await unwrapResponse<any>(response);
            if (!data) return [];

            const locations = Array.isArray(data) ? data : [data];

            return locations.map((loc: any) => ({
                lat: loc.lat || 0,
                lon: loc.lng || 0,
                conf: 100,
                status: 1, // Assumindo ativo se retornou
                battery: batteryToInfo(loc.battery),
                timestamp: loc.timestamp ? (loc.timestamp.toString().length > 10 ? loc.timestamp : loc.timestamp * 1000) : Date.now(),
                isodatetime: loc.timestamp 
                    ? new Date(loc.timestamp.toString().length > 10 ? loc.timestamp : loc.timestamp * 1000).toISOString() 
                    : new Date().toISOString()
            }));

        } catch (err) {
            console.error('XADTAG Fetch Location Error:', err);
            return [];
        }
    },

    /**
     * GET /tag/history — Get Tag trajectory
     */
    fetchHistory: async (
        tag: Tag,
        startTime: number,
        endTime: number
    ): Promise<KTagLocationResult[]> => {

        if (!tag.traqcareId) return [];

        try {
            const settings = await storage.getSettings();
            // Enviando timestamps em MS (long)
            const targetUrl = await resolveUrl('/tag/history', {
                id: tag.traqcareId,
                timeFrom: startTime.toString(),
                timeTo: endTime.toString()
            });
            
            const headers = await getHeaders();
            let response;

            if (settings.customProxyUrl) {
                response = await fetchWithTimeout(settings.customProxyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: targetUrl,
                        method: 'GET',
                        headers
                    })
                });
            } else {
                response = await fetchWithTimeout(targetUrl, { method: 'GET', headers });
            }

            if (!response.ok) {
                console.warn(`TraqCare History HTTP Error: ${response.status}`);
                return [];
            }

            const points = await unwrapResponse<any[]>(response);
            if (!points || !Array.isArray(points)) return [];

            return points.map((p: any) => ({
                lat: p.lat,
                lon: p.lng,
                conf: 100,
                status: 1,
                distance: p.distance || 0,
                battery: { level: 0, label: 'Histórico', color: '#71717a' },
                timestamp: p.timestamp ? (p.timestamp.toString().length > 10 ? p.timestamp : p.timestamp * 1000) : 0,
                isodatetime: p.timestamp 
                    ? new Date(p.timestamp.toString().length > 10 ? p.timestamp : p.timestamp * 1000).toISOString() 
                    : ''
            }));

        } catch (err) {
            console.error('XADTAG History Error:', err);
            return [];
        }
    },

    /**
     * Diagnostic / Ping
     */
    diagnose: async (tag: Tag): Promise<{ summary: string; raw: any }> => {
        if (!tag.traqcareId) return { summary: 'ID Traqcare não configurado', raw: null };

        try {
            const settings = await storage.getSettings();
            if (!settings.traqcareToken) return { summary: 'Token API não configurado', raw: null };

            // Testa endpoint singular
            const targetUrl = await resolveUrl('/tag', { id: tag.traqcareId });
            const headers = await getHeaders();
            
            let response;
            if (settings.customProxyUrl) {
                response = await fetchWithTimeout(settings.customProxyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: targetUrl,
                        method: 'GET',
                        headers
                    })
                });
            } else {
                response = await fetchWithTimeout(targetUrl, { method: 'GET', headers });
            }
            
            const rawText = await response.text();
            let raw;
            try { raw = JSON.parse(rawText); } catch { raw = rawText; }
            
            if (!response.ok) return { summary: `Erro HTTP: ${response.status}`, raw };
            
            // Verifica estrutura de resposta
            if (raw.statusCode && raw.statusCode !== 200) {
                return { summary: `API Error: ${raw.message}`, raw };
            }

            const data = raw.data !== undefined ? raw.data : raw;
            const item = Array.isArray(data) ? data[0] : data;
            
            if (!item) return { summary: 'Dispositivo não encontrado na base TraqCare', raw };
            
            const bat = batteryToInfo(item.battery);
            // Verifica se tem lat/lng para confirmar que é um objeto de location válido
            const hasLoc = item.lat !== undefined && item.lng !== undefined;

            return {
                summary: `Conectado | Bateria: ${bat.label} | ${hasLoc ? 'Localização OK' : 'Sem Localização'}`,
                raw: item
            };
        } catch (e: any) {
            return { summary: `Falha Crítica: ${e.message}`, raw: { stack: e.stack } };
        }
    }
};
