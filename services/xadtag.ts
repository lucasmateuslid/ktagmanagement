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
            } finally {
                requestCount--;
                processQueue();
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
    // API XADTAG (Traqcare): 0=Normal, 3=Muito baixo (mesma semântica do K-TAG)
    switch (battery) {
        case 0: return { level: 100, label: 'Alto', color: '#10b981' };
        case 1: return { level: 60, label: 'Médio', color: '#eab308' };
        case 2: return { level: 30, label: 'Baixo', color: '#f97316' };
        case 3: return { level: 10, label: 'Crítico', color: '#ef4444' };
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

const getHeaders = async (accountId?: string) => {
    const settings = await storage.getSettings();

    let token = settings.traqcareToken || '';
    if (accountId && settings.traqcareAccounts && settings.traqcareAccounts.length > 0) {
        const acc = settings.traqcareAccounts.find((a: any) => a.id === accountId);
        if (acc) token = acc.token;
    }

    return {
        'Content-Type': 'application/json',
        'api_token': token,
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

    // Fallback for proxy unwrapped payload
    if (json.statusCode === undefined) {
        return json as T;
    }

    if (json.statusCode !== 200) {
        throw new Error(json.message || json.problem || 'Erro API');
    }

    return json.data ?? null;
};

const callApi = async (
    path: string,
    method: 'GET' | 'PATCH',
    params?: Record<string, string>,
    body?: any,
    accountId?: string
) => {
    const settings = await storage.getSettings();
    const headers = await getHeaders(accountId);
    const targetUrl = buildUrl(path, params);

    const response = await rateLimitedFetch(async () => {
        let proxyUrl = settings.customProxyUrl || '/api/proxy';
        
        try {
            return await fetchWithTimeout(proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: targetUrl,
                    method,
                    headers,
                    body: body ? JSON.stringify(body) : undefined
                })
            });
        } catch (err: any) {
             if (settings.customProxyUrl) {
                 console.warn(`[XADTAG] customProxyUrl failed (${err.message}). Falling back to /api/proxy.`);
                 return await fetchWithTimeout('/api/proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: targetUrl,
                        method,
                        headers,
                        body: body ? JSON.stringify(body) : undefined
                    })
                 });
             }
             throw err;
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
                [tag.traqcareId],
                tag.traqcareAccountId
            );

            await unwrapResponse(response);
            return true;

        } catch (err) {
            console.error('Activation Error:', err);
            return false;
        }
    },

    fetchLocation: async (tag: Tag, logger?: (log: any) => void): Promise<KTagLocationResult[]> => {
        if (!tag.traqcareId) return [];

        try {
            const settings = await storage.getSettings();
            let tokenUsed = settings.traqcareToken || 'NÃO CONFIGURADO';
            if (tag.traqcareAccountId && settings.traqcareAccounts && settings.traqcareAccounts.length > 0) {
                const acc = settings.traqcareAccounts.find((a: any) => a.id === tag.traqcareAccountId);
                if (acc) tokenUsed = acc.token;
            }
            const maskedToken = tokenUsed.length > 8 ? `${tokenUsed.substring(0, 4)}...${tokenUsed.substring(tokenUsed.length - 4)}` : tokenUsed;

            if (logger) logger({ type: 'info', method: 'GET', url: `/tag?ids=${tag.traqcareId}`, responseBody: { message: 'Buscando última localização da Traqcare API...', token: maskedToken } });

            const response = await callApi(
                '/tag',
                'GET',
                { ids: tag.traqcareId },
                undefined,
                tag.traqcareAccountId
            );

            const data = await unwrapResponse<any[]>(response);
            if (!data || !Array.isArray(data)) {
                if (logger) logger({ type: 'warning', method: 'GET', url: '/tag', responseBody: 'Nenhum dado retornado da Traqcare.' });
                return [];
            }

            console.log('XADTAG RAW DATA:', data);
            
            if (logger) logger({ type: 'success', method: 'GET', url: '/tag', responseBody: 'Localização processada com sucesso.' });

            return data.map((loc) => ({
                lat: Number(loc.lat ?? loc.latitude ?? 0),
                lon: Number(loc.lng ?? loc.longitude ?? loc.lon ?? 0),
                conf: 100,
                status: 1,
                battery: batteryToInfo(loc.battery),
                timestamp: loc.timestamp ? loc.timestamp * 1000 : Date.now(),
                isodatetime: loc.timestamp ? new Date(loc.timestamp * 1000).toISOString() : new Date().toISOString()
            }));

        } catch (err: any) {
            console.error('Fetch Location Error:', err);
            if (logger) logger({ type: 'error', method: 'ERROR', url: 'API', responseBody: `Falha ao buscar localização: ${err.message}` });
            return [];
        }
    },

    fetchHistory: async (
        tag: Tag,
        startTime: number,
        endTime: number,
        logger?: (log: any) => void
    ): Promise<KTagLocationResult[]> => {

        if (!tag.traqcareId) return [];

        try {
            const settings = await storage.getSettings();
            let tokenUsed = settings.traqcareToken || 'NÃO CONFIGURADO';
            if (tag.traqcareAccountId && settings.traqcareAccounts && settings.traqcareAccounts.length > 0) {
                const acc = settings.traqcareAccounts.find((a: any) => a.id === tag.traqcareAccountId);
                if (acc) tokenUsed = acc.token;
            }
            const maskedToken = tokenUsed.length > 8 ? `${tokenUsed.substring(0, 4)}...${tokenUsed.substring(tokenUsed.length - 4)}` : tokenUsed;

            if (logger) logger({ type: 'info', method: 'GET', url: `/tag/history`, responseBody: { message: `Buscando histórico de localização (Traqcare API)...`, token: maskedToken } });

            const response = await callApi(
                '/tag/history',
                'GET',
                {
                    Id: tag.traqcareId,
                    TimeFrom: Math.floor(startTime / 1000).toString(),
                    TimeTo: Math.floor(endTime / 1000).toString()
                },
                undefined,
                tag.traqcareAccountId
            );

            const points = await unwrapResponse<any[]>(response);
            if (!points) {
                if (logger) logger({ type: 'warning', method: 'GET', url: '/tag/history', responseBody: 'Histórico vazio retornado da Traqcare.' });
                return [];
            }
            
            if (logger) logger({ type: 'success', method: 'GET', url: '/tag/history', responseBody: `${points.length} pontos de histórico encontrados.` });

            return points.map((p) => ({
                lat: Number(p.lat ?? p.latitude ?? 0),
                lon: Number(p.lng ?? p.longitude ?? p.lon ?? 0),
                conf: 100,
                status: 1,
                distance: p.distance ?? 0,
                battery: { level: 0, label: 'Histórico', color: '#71717a' },
                timestamp: p.timestamp ? p.timestamp * 1000 : Date.now(),
                isodatetime: p.timestamp ? new Date(p.timestamp * 1000).toISOString() : new Date().toISOString()
            }));

        } catch (err: any) {
            console.error('History Error:', err);
            if (logger) logger({ type: 'error', method: 'ERROR', url: 'API', responseBody: `Falha ao buscar histórico: ${err.message}` });
            return [];
        }
    },

    activateAndDiscover: async (macAddress: string, accountId?: string, logger?: (log: any) => void): Promise<{ success: boolean; traqcareId?: string; message: string }> => {
        if (!macAddress) {
            return { success: false, message: 'MAC Address não fornecido.' };
        }

        const normalizedMac = macAddress.replace(/[^A-Z0-9]/ig, '').toUpperCase();

        try {
            // Get the settings to find out which token is being used
            const settings = await storage.getSettings();
            let tokenUsed = settings.traqcareToken || 'NÃO CONFIGURADO';
            if (accountId && settings.traqcareAccounts && settings.traqcareAccounts.length > 0) {
                const acc = settings.traqcareAccounts.find((a: any) => a.id === accountId);
                if (acc) tokenUsed = acc.token;
            }

            const maskedToken = tokenUsed.length > 8 ? `${tokenUsed.substring(0, 4)}...${tokenUsed.substring(tokenUsed.length - 4)}` : tokenUsed;

            if (logger) logger({ type: 'info', method: 'DISCOVER', url: 'Traqcare API', responseBody: { message: `Iniciando busca do MAC: ${normalizedMac}`, token: maskedToken } });

            // Passo 1: Buscar todos os IDs
            if (logger) logger({ type: 'info', method: 'GET', url: '/tag/all', responseBody: 'Buscando lista de IDs vinculados ao token...' });
            const allResponse = await callApi('/tag/all', 'GET', undefined, undefined, accountId);
            const allIds = await unwrapResponse<number[]>(allResponse);

            if (!allIds || !Array.isArray(allIds) || allIds.length === 0) {
                if (logger) logger({ type: 'warning', method: 'GET', url: '/tag/all', responseBody: 'Nenhum dispositivo encontrado na base Traqcare.' });
                return { success: false, message: 'Nenhum dispositivo encontrado na base Traqcare.' };
            }

            if (logger) logger({ type: 'success', method: 'GET', url: '/tag/all', responseBody: `${allIds.length} dispositivos encontrados.` });

            // Passo 2: Buscar detalhes de todos os IDs
            const idsString = allIds.join(',');
            if (logger) logger({ type: 'info', method: 'GET', url: '/tag?ids=', responseBody: 'Buscando detalhes para cruzar o MAC Address...' });
            const detailsResponse = await callApi('/tag', 'GET', { ids: idsString }, undefined, accountId);
            const details = await unwrapResponse<any[]>(detailsResponse);

            if (!details || !Array.isArray(details)) {
                if (logger) logger({ type: 'error', method: 'GET', url: '/tag', responseBody: 'Falha ao buscar detalhes dos dispositivos Traqcare.' });
                return { success: false, message: 'Falha ao buscar detalhes dos dispositivos Traqcare.' };
            }

            // Passo 3: Cruzar pelo MAC
            const targetDevice = details.find(d => {
                if (!d.mac) return false;
                const dMac = d.mac.replace(/[^A-Z0-9]/ig, '').toUpperCase();
                return dMac === normalizedMac;
            });

            if (!targetDevice || !targetDevice.id) {
                if (logger) logger({ type: 'error', method: 'SEARCH', url: 'Local', responseBody: `Dispositivo com MAC ${normalizedMac} não encontrado na lista de devices do token.` });
                return { success: false, message: `Dispositivo com MAC ${normalizedMac} não encontrado na base Traqcare.` };
            }

            const traqcareId = targetDevice.id.toString();
            if (logger) logger({ type: 'success', method: 'SEARCH', url: 'Local', responseBody: `Match encontrado! Traqcare ID: ${traqcareId}` });

            // Passo 4: Ativar o dispositivo
            try {
                if (logger) logger({ type: 'info', method: 'PATCH', url: '/tag', responseBody: `Enviando comando de ativação para ID ${traqcareId}...` });
                const activateResponse = await callApi('/tag', 'PATCH', undefined, [traqcareId], accountId);
                await unwrapResponse(activateResponse);
                if (logger) logger({ type: 'success', method: 'PATCH', url: '/tag', responseBody: 'Ativação concluída com sucesso!' });
                return { success: true, traqcareId, message: 'Dispositivo ativado com sucesso.' };
            } catch (activateErr: any) {
                console.error('Activation Error during discover:', activateErr);
                if (logger) logger({ type: 'error', method: 'PATCH', url: '/tag', responseBody: `Falha ao ativar: ${activateErr.message}` });
                return { 
                    success: false, 
                    traqcareId, 
                    message: `ID ${traqcareId} encontrado, mas falha ao ativar: ${activateErr.message}` 
                };
            }

        } catch (err: any) {
            console.error('Discover Error:', err);
            if (logger) logger({ type: 'error', method: 'ERROR', url: 'API', responseBody: `Erro de comunicação: ${err.message}` });
            return { success: false, message: `Erro na comunicação com a API: ${err.message}` };
        }
    },

    diagnose: async (tag: Tag, logger?: (log: any) => void): Promise<{ summary: string; raw: any }> => {
        if (!tag.traqcareId) return { summary: 'ID Traqcare não configurado', raw: null };

        try {
            const settings = await storage.getSettings();
            let tokenUsed = settings.traqcareToken || 'NÃO CONFIGURADO';
            if (tag.traqcareAccountId && settings.traqcareAccounts && settings.traqcareAccounts.length > 0) {
                const acc = settings.traqcareAccounts.find((a: any) => a.id === tag.traqcareAccountId);
                if (acc) tokenUsed = acc.token;
            }

            const maskedToken = tokenUsed.length > 8 ? `${tokenUsed.substring(0, 4)}...${tokenUsed.substring(tokenUsed.length - 4)}` : tokenUsed;

            if (logger) logger({ type: 'info', method: 'DIAGNOSE', url: 'Traqcare API', responseBody: { message: `Iniciando diagnóstico do ID: ${tag.traqcareId}`, token: maskedToken } });

            if (logger) logger({ type: 'info', method: 'GET', url: `/tag?ids=${tag.traqcareId}`, responseBody: 'Buscando informações do dispositivo...' });

            const response = await callApi(
                '/tag',
                'GET',
                { ids: tag.traqcareId },
                undefined,
                tag.traqcareAccountId
            );
            
            const raw = await response.clone().json();
            
            if (!response.ok) {
                if (logger) logger({ type: 'error', method: 'GET', url: '/tag', responseBody: `Erro HTTP: ${response.status}` });
                return { summary: `Erro HTTP: ${response.status}`, raw };
            }
            
            if (raw.statusCode && raw.statusCode !== 200) {
                if (logger) logger({ type: 'error', method: 'GET', url: '/tag', responseBody: `API Error: ${raw.message}` });
                return { summary: `API Error: ${raw.message}`, raw };
            }

            const data = raw.data !== undefined ? raw.data : raw;
            const item = Array.isArray(data) ? data[0] : data;
            
            if (!item) {
                if (logger) logger({ type: 'warning', method: 'GET', url: '/tag', responseBody: 'Dispositivo não encontrado na base TraqCare com este token.' });
                return { summary: 'Dispositivo não encontrado na base TraqCare', raw };
            }
            
            const bat = batteryToInfo(item.battery);
            const hasLoc = item.lat !== undefined && item.lng !== undefined;

            if (logger) logger({ type: 'success', method: 'GET', url: '/tag', responseBody: 'Diagnóstico concluído com sucesso.' });

            return {
                summary: `Conectado | Bateria: ${bat.label} | ${hasLoc ? 'Localização OK' : 'Sem Localização'}`,
                raw: item
            };
        } catch (e: any) {
            if (logger) logger({ type: 'error', method: 'ERROR', url: 'API', responseBody: `Falha Crítica: ${e.message}` });
            return { summary: `Falha Crítica: ${e.message}`, raw: { stack: e.stack } };
        }
    }
};