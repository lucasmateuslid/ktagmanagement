import { storage } from './storage';
import { Tag, KTagLocationResult, KTagBatteryInfo } from '../types';

/* =====================================================
   TRACCAR API SERVICE
===================================================== */

const getHeaders = async (settings: any) => {
    const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };

    if (settings.traccarToken) {
        headers['Authorization'] = `Bearer ${settings.traccarToken}`;
    } else if (settings.traccarUser && settings.traccarPass) {
        headers['Authorization'] = 'Basic ' + btoa(`${settings.traccarUser}:${settings.traccarPass}`);
    }

    return headers;
};

const buildUrl = (baseUrl: string, path: string, params?: Record<string, string>) => {
    let cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return `${cleanBase}${cleanPath}${query}`;
};

const callTraccarApi = async (path: string, method: 'GET' | 'POST', params?: Record<string, string>, body?: any) => {
    const settings = await storage.getSettings();
    if (!settings.traccarUrl) {
        throw new Error('URL da Traccar não configurada');
    }

    const headers = await getHeaders(settings);
    const targetUrl = buildUrl(settings.traccarUrl, path, params);

    // Usa o proxy customizado para contornar CORS, se configurado
    let proxyUrl = settings.customProxyUrl || '/api/proxy';
    
    try {
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: targetUrl,
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const json = await response.json();
        if (json.statusCode && json.statusCode !== 200 && json.statusCode !== 201) {
             throw new Error(json.message || `Proxy Error: ${json.statusCode}`);
        }

        return json.data !== undefined ? json.data : json;
    } catch (err: any) {
         if (settings.customProxyUrl) {
             console.warn(`[TRACCAR] customProxyUrl failed (${err.message}). Falling back to /api/proxy.`);
             const response = await fetch('/api/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: targetUrl,
                    method,
                    headers,
                    body: body ? JSON.stringify(body) : undefined
                })
             });
             
             if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
             const json = await response.json();
             return json.data !== undefined ? json.data : json;
         }
         throw err;
    }
};

export const traccarService = {

    getDevices: async (logger?: (log: any) => void) => {
        try {
            if (logger) logger({ type: 'info', method: 'GET', url: '/api/devices', responseBody: 'Buscando dispositivos da Traccar...' });
            const data = await callTraccarApi('/api/devices', 'GET');
            if (logger) logger({ type: 'success', method: 'GET', url: '/api/devices', responseBody: data });
            return data;
        } catch (error: any) {
            if (logger) logger({ type: 'error', method: 'GET', url: '/api/devices', responseBody: error.message });
            throw error;
        }
    },

    diagnose: async (uniqueId: string, logger?: (log: any) => void): Promise<{ summary: string; raw: any }> => {
        try {
            if (logger) logger({ type: 'info', method: 'GET', url: `/api/devices?uniqueId=${uniqueId}`, responseBody: `Buscando dispositivo ${uniqueId} na Traccar...` });
            const devices = await callTraccarApi('/api/devices', 'GET', { uniqueId });
            
            if (!devices || devices.length === 0) {
                 if (logger) logger({ type: 'warning', method: 'GET', url: '/api/devices', responseBody: 'Dispositivo não encontrado na Traccar.' });
                 return { summary: 'Não encontrado na Traccar', raw: null };
            }

            const device = devices[0];
            if (logger) logger({ type: 'success', method: 'GET', url: '/api/devices', responseBody: device });

            let batteryLevel = 0;
            if (device.attributes && device.attributes.batteryLevel !== undefined) {
                batteryLevel = device.attributes.batteryLevel;
            }

            return {
                summary: `Conectado | Status: ${device.status} | Bateria: ${batteryLevel}% | Última atualização: ${new Date(device.lastUpdate).toLocaleString()}`,
                raw: device
            };

        } catch (error: any) {
             if (logger) logger({ type: 'error', method: 'GET', url: '/api/devices', responseBody: error.message });
             return { summary: `Erro Traccar: ${error.message}`, raw: error };
        }
    },

    fetchLocation: async (deviceId: number, logger?: (log: any) => void): Promise<KTagLocationResult[]> => {
        try {
            if (logger) logger({ type: 'info', method: 'GET', url: `/api/positions?deviceId=${deviceId}`, responseBody: 'Buscando última posição da Traccar...' });
            
            const positions = await callTraccarApi('/api/positions', 'GET', { deviceId: deviceId.toString() });
            
            if (!positions || positions.length === 0) {
                 if (logger) logger({ type: 'warning', method: 'GET', url: '/api/positions', responseBody: 'Nenhuma posição encontrada.' });
                 return [];
            }

            if (logger) logger({ type: 'success', method: 'GET', url: '/api/positions', responseBody: positions[0] });

            return positions.map((pos: any) => {
                 let batLevel = pos.attributes?.batteryLevel || pos.attributes?.battery || 0;
                 let battery: KTagBatteryInfo = { level: batLevel, label: batLevel + '%', color: batLevel > 20 ? '#10b981' : '#ef4444' };

                 return {
                     lat: pos.latitude,
                     lon: pos.longitude,
                     conf: pos.accuracy || 100,
                     status: 1,
                     battery,
                     timestamp: new Date(pos.fixTime || pos.deviceTime || pos.serverTime).getTime(),
                     isodatetime: pos.fixTime || pos.deviceTime || pos.serverTime
                 };
            });

        } catch (error: any) {
             if (logger) logger({ type: 'error', method: 'GET', url: '/api/positions', responseBody: error.message });
             return [];
        }
    },

    fetchHistory: async (deviceId: number, startTime: number, endTime: number, logger?: (log: any) => void): Promise<KTagLocationResult[]> => {
        try {
            const from = new Date(startTime).toISOString();
            const to = new Date(endTime).toISOString();

            if (logger) logger({ type: 'info', method: 'GET', url: `/api/reports/route`, responseBody: `Buscando histórico de ${from} a ${to}` });

            const positions = await callTraccarApi('/api/reports/route', 'GET', { 
                deviceId: deviceId.toString(),
                from,
                to 
            });

            if (!positions || positions.length === 0) {
                if (logger) logger({ type: 'warning', method: 'GET', url: '/api/reports/route', responseBody: 'Nenhum histórico encontrado no período.' });
                return [];
            }

            if (logger) logger({ type: 'success', method: 'GET', url: '/api/reports/route', responseBody: `${positions.length} posições encontradas.` });

            return positions.map((pos: any) => {
                 let batLevel = pos.attributes?.batteryLevel || pos.attributes?.battery || 0;
                 let battery: KTagBatteryInfo = { level: batLevel, label: 'Histórico', color: '#71717a' };

                 return {
                     lat: pos.latitude,
                     lon: pos.longitude,
                     conf: pos.accuracy || 100,
                     status: 1,
                     battery,
                     timestamp: new Date(pos.fixTime || pos.deviceTime || pos.serverTime).getTime(),
                     isodatetime: pos.fixTime || pos.deviceTime || pos.serverTime
                 };
            });

        } catch (error: any) {
             if (logger) logger({ type: 'error', method: 'GET', url: '/api/reports/route', responseBody: error.message });
             return [];
        }
    }
};
