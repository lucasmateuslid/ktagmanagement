import { storage } from './storage';
import { Tag, KTagLocationResult, KTagBatteryInfo } from '../types';

const BASE_URL = 'http://www.brgps.com/open';
const REQUEST_TIMEOUT = 20000;

/* =====================================================
   RATE LIMITER (100 req / min)
===================================================== */

const MAX_REQUESTS_PER_MINUTE = 100;
let requestQueue: (() => void)[] = [];
let requestCount = 0;

setInterval(() => {
    requestCount = 0;
    processQueue();
}, 60000);

const processQueue = () => {
    while (requestQueue.length > 0 && requestCount < MAX_REQUESTS_PER_MINUTE) {
        const next = requestQueue.shift();
        if (next) {
            requestCount++;
            next();
        }
    }
};

const rateLimitedFetch = (fn: () => Promise<Response>): Promise<Response> => {
    return new Promise((resolve, reject) => {
        const execute = async () => {
            try {
                const result = await fn();
                resolve(result);
            } catch (err) {
                reject(err);
            }
        };

        requestQueue.push(execute);
        processQueue();
    });
};

/* =====================================================
   UTILS
===================================================== */

const batteryToInfo = (battery?: number): KTagBatteryInfo => {
    switch (battery) {
        case 3: return { level: 100, label: 'Alto', color: '#10b981' };
        case 2: return { level: 60, label: 'Médio', color: '#eab308' };
        case 1: return { level: 30, label: 'Baixo', color: '#f97316' };
        case 0: return { level: 10, label: 'Crítico', color: '#ef4444' };
        default: return { level: 0, label: 'N/A', color: '#71717a' };
    }
};

const fetchWithTimeout = async (url: string, options: RequestInit = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
};

const getHeaders = async () => {
    const settings = await storage.getSettings();

    return {
        'Content-Type': 'application/json',
        'api_token': settings.traqcareToken || '',
        'timestamp': Math.floor(Date.now() / 1000).toString(),
    };
};

const buildUrl = (path: string, params?: Record<string, string>) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return `${BASE_URL}${cleanPath}${query}`;
};

const unwrapResponse = async <T>(response: Response): Promise<T | null> => {
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();

    if (json.statusCode !== 200) {
        throw new Error(json.message || json.problem || 'Erro API');
    }

    return json.data ?? null;
};

const callApi = async (
    path: string,
    method: 'GET' | 'PATCH',
    params?: Record<string, string>,
    body?: any
) => {
    const settings = await storage.getSettings();
    const headers = await getHeaders();
    const targetUrl = buildUrl(path, params);

    const response = await rateLimitedFetch(() => {
        if (settings.customProxyUrl) {
            return fetchWithTimeout(settings.customProxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: targetUrl,
                    method,
                    headers,
                    body: body ? JSON.stringify(body) : undefined
                })
            });
        } else {
            return fetchWithTimeout(targetUrl, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined
            });
        }
    });

    return response;
};

/* =====================================================
   SERVICE
===================================================== */

export const xadtagService = {

    activate: async (tag: Tag): Promise<boolean> => {
        if (!tag.traqcareId) return false;

        try {
            const response = await callApi(
                '/tag',
                'PATCH',
                undefined,
                [tag.traqcareId]
            );

            await unwrapResponse(response);
            return true;

        } catch (err) {
            console.error('Activation Error:', err);
            return false;
        }
    },

    fetchLocation: async (tag: Tag): Promise<KTagLocationResult[]> => {
        if (!tag.traqcareId) return [];

        try {
            const response = await callApi(
                '/tag',
                'GET',
                { ids: tag.traqcareId }
            );

            const data = await unwrapResponse<any[]>(response);
            if (!data || !Array.isArray(data)) return [];

            return data.map((loc) => ({
                lat: loc.lat ?? 0,
                lon: loc.lng ?? 0,
                conf: 100,
                status: 1,
                battery: batteryToInfo(loc.battery),
                timestamp: loc.timestamp * 1000,
                isodatetime: new Date(loc.timestamp * 1000).toISOString()
            }));

        } catch (err) {
            console.error('Fetch Location Error:', err);
            return [];
        }
    },

    fetchHistory: async (
        tag: Tag,
        startTime: number,
        endTime: number
    ): Promise<KTagLocationResult[]> => {

        if (!tag.traqcareId) return [];

        try {
            const response = await callApi(
                '/tag/history',
                'GET',
                {
                    Id: tag.traqcareId,
                    TimeFrom: Math.floor(startTime / 1000).toString(),
                    TimeTo: Math.floor(endTime / 1000).toString()
                }
            );

            const points = await unwrapResponse<any[]>(response);
            if (!points) return [];

            return points.map((p) => ({
                lat: p.lat ?? 0,
                lon: p.lng ?? 0,
                conf: 100,
                status: 1,
                distance: p.distance ?? 0,
                battery: { level: 0, label: 'Histórico', color: '#71717a' },
                timestamp: p.timestamp * 1000,
                isodatetime: new Date(p.timestamp * 1000).toISOString()
            }));

        } catch (err) {
            console.error('History Error:', err);
            return [];
        }
    },

    diagnose: async (tag: Tag): Promise<{ summary: string; raw: any }> => {
        if (!tag.traqcareId) return { summary: 'ID Traqcare não configurado', raw: null };

        try {
            const response = await callApi(
                '/tag',
                'GET',
                { ids: tag.traqcareId }
            );
            
            const raw = await response.clone().json();
            
            if (!response.ok) return { summary: `Erro HTTP: ${response.status}`, raw };
            
            if (raw.statusCode && raw.statusCode !== 200) {
                return { summary: `API Error: ${raw.message}`, raw };
            }

            const data = raw.data !== undefined ? raw.data : raw;
            const item = Array.isArray(data) ? data[0] : data;
            
            if (!item) return { summary: 'Dispositivo não encontrado na base TraqCare', raw };
            
            const bat = batteryToInfo(item.battery);
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