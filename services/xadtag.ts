
import { storage } from './storage';
import { Tag, KTagLocationResult, KTagBatteryInfo } from '../types';

// This service currently consumes TraqCare API directly
// It will be converted into a thin client once backend proxy is implemented

const BASE_URL = 'https://tags.traqcare.com/api';

/**
 * UTILS & PARSERS
 */

// Adapter for TraqCare Battery (Inverted logic vs K-TAG)
// 3=High (100%), 0=Very Low (10%)
const batteryToInfo = (battery?: number): KTagBatteryInfo => {
    switch (battery) {
        case 3: return { level: 100, label: 'Alto', color: '#10b981' };
        case 2: return { level: 60, label: 'Médio', color: '#eab308' };
        case 1: return { level: 30, label: 'Baixo', color: '#f97316' };
        case 0: return { level: 10, label: 'Muito baixo', color: '#ef4444' };
        default: return { level: 0, label: 'Desconhecido', color: '#71717a' };
    }
};

// Converts Milliseconds (App) to Unix Seconds (API)
const toUnixSeconds = (ms: number) => Math.floor(ms / 1000);

// Resolves URL based on Proxy settings
const resolveUrl = async (path: string, params?: Record<string, string>) => {
    const settings = await storage.getSettings();
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    
    // If custom proxy is set, the path logic might differ based on proxy implementation.
    // Assuming standard proxy behavior or direct access for now.
    const baseUrl = settings.customProxyUrl || BASE_URL;
    
    // Ensure we don't double slash
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    
    return `${cleanBase}${cleanPath}${query}`;
};

// Centralized Headers
const getHeaders = async (extra?: Record<string, string>) => {
    const settings = await storage.getSettings();
    // TODO: api_token and timestamp will be injected by backend proxy in future migration
    return {
        'Content-Type': 'application/json',
        'api_token': settings.traqcareToken,
        'timestamp': toUnixSeconds(Date.now()).toString(),
        ...(extra ?? {})
    };
};

// Universal Response Parser (Handles Wrapped vs Direct JSON)
const unwrapResponse = async <T>(response: Response): Promise<T | null> => {
    try {
        const text = await response.text();
        if (!text) return null;
        
        const json = JSON.parse(text);

        // Check for Wrapped Format: { statusCode: 200, data: [...] }
        if (json && typeof json === 'object' && 'statusCode' in json) {
            if (json.statusCode !== 200) {
                console.warn(`TraqCare API Error: ${json.message || json.statusCode}`);
                return null;
            }
            return (json.data ?? null) as T;
        }

        // Assume Direct Format: [...] or { ... }
        return json as T;
    } catch (e) {
        console.error("TraqCare Parse Error", e);
        return null;
    }
};

/**
 * INTERFACES (Raw API Types)
 */
interface TraqCareLocation {
    id: number;
    lat: number;
    lng: number;
    battery: number;
    isActived: boolean;
    timestamp: number; // Unix Seconds
}

interface TraqCareHistoryPoint {
    lat: number;
    lng: number;
    timestamp: number; // Unix Seconds
    distance: number;
}

/**
 * SERVICE IMPLEMENTATION
 */
export const xadtagService = {
    /**
     * Ativação obrigatória do dispositivo
     * PATCH /tag Body: [tagId]
     */
    activate: async (tag: Tag): Promise<boolean> => {
        if (!tag.traqcareId) return false;

        try {
            // Documentação exige array de IDs no body
            const body = JSON.stringify([tag.traqcareId]);
            
            const settings = await storage.getSettings();
            const targetUrl = settings.customProxyUrl || `${BASE_URL}/tag`;

            const response = await fetch(targetUrl, {
                method: 'PATCH',
                headers: await getHeaders(),
                body: body
            });

            // Even if wrapped, if statusCode is 200 it counts as success
            const result = await unwrapResponse<any>(response);
            return !!result;
        } catch (e) {
            console.error("XADTAG Activation Error:", e);
            return false;
        }
    },

    /**
     * Consulta de localização atual
     * GET /tag?ids=123
     */
    fetchLocation: async (tag: Tag): Promise<KTagLocationResult[]> => {
        if (!tag.traqcareId) return [];

        try {
            // Param 'ids' according to doc
            const settings = await storage.getSettings();
            const url = new URL(`${BASE_URL}/tag`);
            url.searchParams.append('ids', tag.traqcareId);

            const response = await fetch(settings.customProxyUrl || url.toString(), {
                method: 'GET',
                headers: await getHeaders()
            });

            if (!response.ok) return [];

            // API can return a single object or an array of objects
            const data = await unwrapResponse<TraqCareLocation | TraqCareLocation[]>(response);
            
            if (!data) return [];

            // Normalize to array
            const locations = Array.isArray(data) ? data : [data];
            
            // Map to KTag format with Standard Battery Object
            return locations.map(loc => ({
                lat: loc.lat,
                lon: loc.lng, // Adapter: lng -> lon
                conf: loc.battery === 3 ? 100 : (loc.battery === 2 ? 60 : 30), // Legacy conf mapping
                status: loc.isActived ? 1 : 0,
                battery: batteryToInfo(loc.battery), // New Standard Battery
                timestamp: loc.timestamp * 1000, // Seconds -> Ms
                isodatetime: new Date(loc.timestamp * 1000).toISOString()
            }));

        } catch (e) {
            console.error("XADTAG Fetch Error:", e);
            return [];
        }
    },

    /**
     * Histórico de trajeto
     * GET /tag/history?Id=123&TimeFrom=unix&TimeTo=unix
     */
    fetchHistory: async (tag: Tag, startTime: number, endTime: number): Promise<KTagLocationResult[]> => {
        if (!tag.traqcareId) return [];

        try {
            const settings = await storage.getSettings();
            const url = new URL(`${BASE_URL}/tag/history`);
            
            // Correct params: Id, TimeFrom, TimeTo (Unix Seconds)
            url.searchParams.append('Id', tag.traqcareId);
            url.searchParams.append('TimeFrom', toUnixSeconds(startTime).toString());
            url.searchParams.append('TimeTo', toUnixSeconds(endTime).toString());

            const response = await fetch(settings.customProxyUrl || url.toString(), {
                method: 'GET',
                headers: await getHeaders()
            });

            if (!response.ok) return [];

            const points = await unwrapResponse<TraqCareHistoryPoint[]>(response);
            
            if (!points || !Array.isArray(points)) return [];

            return points.map(p => ({
                lat: p.lat,
                lon: p.lng,
                conf: 100, // History points assumed verified
                status: 1,
                battery: { level: 0, label: 'Histórico', color: '#71717a' }, // History usually doesn't have battery
                timestamp: p.timestamp * 1000, // Seconds -> Ms
                isodatetime: new Date(p.timestamp * 1000).toISOString()
            }));

        } catch (e) {
            console.error("XADTAG History Error:", e);
            return [];
        }
    }
};
