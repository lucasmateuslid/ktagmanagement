
import { storage } from './storage';
import { Tag, KTagLocationResult, KTagBatteryInfo } from '../types';

const BASE_URL = 'https://tags.traqcare.com/api';

/**
 * UTILS & PARSERS
 */

// Adapter for TraqCare Battery
// Documentation implies 0-100 or specific status codes.
// We map typical values to our system's color scheme.
const batteryToInfo = (battery?: number): KTagBatteryInfo => {
    if (battery === undefined || battery === null) {
        return { level: 0, label: 'N/A', color: '#71717a' };
    }

    // If API returns 0-4 scale (common in some firmwares)
    if (battery <= 5 && battery >= 0) {
       // Assuming it might be a status code, or just very low battery if it's 0-100
       // However, often 0 = Empty, 1 = Low, ..., 4 = Full in compact protocols
       // If usage suggests 0-100, we treat low numbers as critical.
    }

    let label = 'Normal';
    let color = '#10b981'; // Green

    if (battery < 20) {
        label = 'Crítico';
        color = '#ef4444'; // Red
    } else if (battery < 50) {
        label = 'Baixo';
        color = '#f97316'; // Orange
    } else if (battery < 80) {
        label = 'Médio';
        color = '#eab308'; // Yellow
    }

    return { level: battery, label, color };
};

// Converts Milliseconds (App) to Unix Seconds (API Requirement)
const toUnixSeconds = (ms: number) => Math.floor(ms / 1000);

// Helper to get headers with fresh timestamp
const getHeaders = (token: string) => {
    return {
        'Content-Type': 'application/json',
        'api_token': token,
        'timestamp': toUnixSeconds(Date.now()).toString(), // API requires String
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
            // Importante: Enviar como string se a API esperar string, ou number se number.
            // A doc mostra "7260100489" no query param example, geralmente strings em JSON.
            // Vamos tentar enviar como numbers primeiro se for numérico.
            const idToActivate = tag.traqcareId; 
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
        if (!tag.traqcareId) throw new Error("ID Traqcare não definido no cadastro.");

        const settings = await storage.getSettings();
        if (!settings.traqcareToken) throw new Error("Token API Traqcare ausente nas configurações.");
        if (!settings.customProxyUrl) throw new Error("Proxy URL ausente nas configurações.");

        // Monta URL com Query Params
        const url = new URL(`${BASE_URL}/tag`);
        url.searchParams.append('ids', tag.traqcareId);
        
        // Adiciona timestamp na query também conforme alguns exemplos de Swagger, 
        // mas a doc diz Header. Vamos manter Header principal.
        
        try {
            const response = await fetch(settings.customProxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url.toString(),
                    method: 'GET',
                    headers: getHeaders(settings.traqcareToken)
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Erro HTTP ${response.status}: ${errText}`);
            }

            const json: TraqCareResponse<TraqCareLocationDto[]> = await response.json();
            
            if (json.statusCode !== 200) {
                throw new Error(json.message || "Erro na API Traqcare");
            }

            if (!json.data || !Array.isArray(json.data) || json.data.length === 0) {
                // Sucesso mas sem dados = array vazio
                return []; 
            }

            // Mapeamento para o formato interno do App
            return json.data.map(loc => ({
                lat: loc.lat,
                lon: loc.lng, 
                conf: 100,
                status: loc.isActived ? 1 : 0,
                battery: batteryToInfo(loc.battery),
                timestamp: loc.timestamp * 1000, 
                isodatetime: new Date(loc.timestamp * 1000).toISOString()
            }));

        } catch (e: any) {
            console.error("[XADTAG] Fetch Error:", e);
            throw e; // Propagate error for UI handling
        }
    },

    /**
     * Histórico de trajeto
     * GET /tag/history
     * Query Params: Id, TimeFrom, TimeTo (Case Sensitive!)
     */
    fetchHistory: async (tag: Tag, startTimeMs: number, endTimeMs: number): Promise<KTagLocationResult[]> => {
        if (!tag.traqcareId) throw new Error("ID Traqcare não definido.");

        const settings = await storage.getSettings();
        if (!settings.traqcareToken || !settings.customProxyUrl) throw new Error("Configuração de API incompleta.");

        const url = new URL(`${BASE_URL}/tag/history`);
        
        // Documentação especifica parâmetros sensíveis a maiúsculas/minúsculas
        url.searchParams.append('Id', tag.traqcareId); 
        url.searchParams.append('TimeFrom', toUnixSeconds(startTimeMs).toString());
        url.searchParams.append('TimeTo', toUnixSeconds(endTimeMs).toString());

        try {
            const response = await fetch(settings.customProxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url.toString(),
                    method: 'GET',
                    headers: getHeaders(settings.traqcareToken)
                })
            });

            if (!response.ok) {
                throw new Error(`Erro Proxy: ${response.status}`);
            }

            const json: TraqCareResponse<TraqCareHistoryDto[]> = await response.json();
            
            if (json.statusCode !== 200) {
                throw new Error(json.message || "Erro API History");
            }

            if (!json.data || !Array.isArray(json.data)) {
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

        } catch (e: any) {
            console.error("[XADTAG] History Error:", e);
            throw e;
        }
    }
};
