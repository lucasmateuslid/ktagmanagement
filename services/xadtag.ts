
import { storage } from './storage';
import { Tag, KTagLocationResult, KTagBatteryInfo } from '../types';

const BASE_URL = 'https://tags.traqcare.com/api';

/**
 * UTILS & PARSERS
 */

// Adapter for TraqCare Battery
// Based on documentation/typical values: 0-4 scale or 0-100.
// Documentation example shows "battery": 0.
const batteryToInfo = (battery?: number): KTagBatteryInfo => {
    if (battery === undefined || battery === null) {
        return { level: 0, label: 'Desconhecido', color: '#71717a' };
    }

    // Escala 0-4 (comum em rastreadores chineses)
    if (battery <= 4) {
        switch (battery) {
            case 3: return { level: 100, label: 'Alto', color: '#10b981' };
            case 2: return { level: 60, label: 'Médio', color: '#eab308' };
            case 1: return { level: 30, label: 'Baixo', color: '#f97316' };
            case 0: return { level: 10, label: 'Crítico', color: '#ef4444' };
            default: return { level: 0, label: 'Desconhecido', color: '#71717a' };
        }
    }

    // Escala percentual (0-100)
    if (battery > 50) return { level: battery, label: 'Normal', color: '#10b981' };
    if (battery > 20) return { level: battery, label: 'Médio', color: '#eab308' };
    return { level: battery, label: 'Baixo', color: '#ef4444' };
};

// Converts Milliseconds (App) to Unix Seconds (API Requirement)
const toUnixSeconds = (ms: number) => Math.floor(ms / 1000);

// Helper to get headers with fresh timestamp
const getHeaders = (token: string) => {
    return {
        'Content-Type': 'application/json',
        'api_token': token,
        'timestamp': toUnixSeconds(Date.now()).toString(), // API exige timestamp em SEGUNDOS
    };
};

/**
 * INTERFACES (Raw API Types from Documentation)
 */
interface TraqCareLocationDto {
    id: number;
    timestamp: number; // Unix Seconds
    publishTime: number;
    lat: number;
    lng: number;
    battery: number;
    mac: string;
    isActived: boolean;
}

interface TraqCareHistoryDto {
    id: number;
    timestamp: number;
    publishTime: number;
    lat: number;
    lng: number;
    distance: number;
}

interface TraqCareResponse<T> {
    statusCode: number;
    message: string;
    data: T | null;
    problem?: string;
}

/**
 * SERVICE IMPLEMENTATION
 */
export const xadtagService = {
    /**
     * Ativação do dispositivo
     * PATCH /tag
     * Body: [id] (Array de IDs)
     */
    activate: async (tag: Tag): Promise<boolean> => {
        if (!tag.traqcareId) {
            console.warn(`[XADTAG] Ativação falhou: Tag ${tag.name} sem Traqcare ID.`);
            return false;
        }

        try {
            const settings = await storage.getSettings();
            if (!settings.traqcareToken) throw new Error("Token da API Traqcare não configurado.");
            if (!settings.customProxyUrl) throw new Error("Proxy não configurado.");

            // A API espera um array de IDs no corpo
            const idToActivate = parseInt(tag.traqcareId) || tag.traqcareId;
            const body = [idToActivate];
            
            const targetUrl = `${BASE_URL}/tag`;

            const response = await fetch(settings.customProxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: targetUrl,
                    method: 'PATCH',
                    headers: getHeaders(settings.traqcareToken),
                    body: body
                })
            });

            if (!response.ok) {
                console.error('[XADTAG] Erro HTTP na ativação:', response.status);
                return false;
            }

            const json = await response.json();
            // A API retorna statusCode 200 no corpo se der certo
            if (json && (json.statusCode === 200 || json.message === 'OK')) {
                return true;
            }
            
            return false;
        } catch (e) {
            console.error("[XADTAG] Activation Error:", e);
            return false;
        }
    },

    /**
     * Consulta de localização atual
     * GET /tag
     * Query: ids (separados por virgula)
     */
    fetchLocation: async (tag: Tag): Promise<KTagLocationResult[]> => {
        if (!tag.traqcareId) return [];

        try {
            const settings = await storage.getSettings();
            if (!settings.traqcareToken || !settings.customProxyUrl) return [];

            // Monta URL com Query Params (ids em minúsculo)
            const url = new URL(`${BASE_URL}/tag`);
            url.searchParams.append('ids', tag.traqcareId);

            const response = await fetch(settings.customProxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url.toString(),
                    method: 'GET',
                    headers: getHeaders(settings.traqcareToken)
                })
            });

            if (!response.ok) return [];

            const json: TraqCareResponse<TraqCareLocationDto[]> = await response.json();
            
            if (!json || json.statusCode !== 200 || !Array.isArray(json.data)) {
                return [];
            }

            // Mapeamento para o formato interno do App
            return json.data.map(loc => ({
                lat: loc.lat,
                lon: loc.lng, // API usa 'lng', App usa 'lon'
                conf: 100,
                status: loc.isActived ? 1 : 0,
                battery: batteryToInfo(loc.battery),
                timestamp: loc.timestamp * 1000, // Seconds -> Milliseconds para JS Date
                isodatetime: new Date(loc.timestamp * 1000).toISOString()
            }));

        } catch (e) {
            console.error("[XADTAG] Fetch Error:", e);
            return [];
        }
    },

    /**
     * Histórico de trajeto
     * GET /tag/history
     * Query Params: Id, TimeFrom, TimeTo (Case Sensitive!)
     */
    fetchHistory: async (tag: Tag, startTimeMs: number, endTimeMs: number): Promise<KTagLocationResult[]> => {
        if (!tag.traqcareId) return [];

        try {
            const settings = await storage.getSettings();
            if (!settings.traqcareToken || !settings.customProxyUrl) return [];

            const url = new URL(`${BASE_URL}/tag/history`);
            
            // Documentação especifica parâmetros sensíveis a maiúsculas/minúsculas
            url.searchParams.append('Id', tag.traqcareId); 
            url.searchParams.append('TimeFrom', toUnixSeconds(startTimeMs).toString());
            url.searchParams.append('TimeTo', toUnixSeconds(endTimeMs).toString());

            const response = await fetch(settings.customProxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url.toString(),
                    method: 'GET',
                    headers: getHeaders(settings.traqcareToken)
                })
            });

            if (!response.ok) return [];

            const json: TraqCareResponse<TraqCareHistoryDto[]> = await response.json();
            
            if (!json || json.statusCode !== 200 || !Array.isArray(json.data)) {
                return [];
            }

            return json.data.map(p => ({
                lat: p.lat,
                lon: p.lng,
                conf: 100,
                status: 1,
                battery: { level: 0, label: 'Histórico', color: '#71717a' },
                timestamp: p.timestamp * 1000,
                isodatetime: new Date(p.timestamp * 1000).toISOString()
            }));

        } catch (e) {
            console.error("[XADTAG] History Error:", e);
            return [];
        }
    }
};
