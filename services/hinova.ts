
import { storage } from './storage';
import { Vehicle, Client, AppSettings } from '../types';

let cachedUserToken: string | null = null;
let authPromise: Promise<string> | null = null;

// Cache e Deduplicação de buscas
const searchPromises = new Map<string, Promise<any>>();
const searchCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutos de cache

// Controle de concorrência e rate limit
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 800; // 800ms entre requisições para evitar 429

const FALLBACK_PROXIES = [
    '/api/proxy'
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const formatBearerToken = (token: string) => {
    if (!token) return '';
    let raw = token.trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '');
    return `Bearer ${raw}`;
};

const executeRequest = async (settings: AppSettings, targetUrl: string, method: string, headers: any, body?: any, proxyIndex = -1) => {
    const proxyUrl = proxyIndex === -1 ? settings.customProxyUrl : FALLBACK_PROXIES[proxyIndex];
    
    let fetchUrl = targetUrl;
    let fetchOptions: RequestInit = {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    };

    // Se houver um proxy configurado ou estivermos usando fallback
    let usingCustomPayload = false;
    if (proxyUrl) {
        if (proxyUrl.includes('corsproxy.io') || proxyUrl.includes('cors-anywhere') || proxyUrl.includes('allorigins') || proxyUrl.endsWith('?') || proxyUrl.endsWith('=')) {
            // Proxies públicos baseados em querystring
            fetchUrl = proxyUrl.endsWith('?') || proxyUrl.endsWith('=') 
                ? `${proxyUrl}${encodeURIComponent(targetUrl)}` 
                : `${proxyUrl}?${encodeURIComponent(targetUrl)}`;
        } else {
            // Proxy customizado (ex: /api/proxy ou Firebase Functions)
            fetchUrl = proxyUrl;
            usingCustomPayload = true;
        }
    } else {
        // Fallback padrão se nenhum proxy for informado
        fetchUrl = '/api/proxy';
        usingCustomPayload = true;
    }

    if (usingCustomPayload) {
        fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: targetUrl,
                method,
                headers,
                body
            })
        };
    }

    try {
        const response = await fetch(fetchUrl, fetchOptions);
        
        // Se o proxy falhar (ex: 403, 404, 500 no proxy), tenta o próximo
        if (!response.ok && response.status >= 500 && proxyIndex < FALLBACK_PROXIES.length - 1) {
            console.warn(`Proxy ${proxyUrl} failed. Trying next fallback...`);
            return executeRequest(settings, targetUrl, method, headers, body, proxyIndex + 1);
        }

        const responseText = await response.text();
        
        let data: any;
        try { 
            data = JSON.parse(responseText); 
        } catch (e) { 
            data = { error: responseText }; 
        }

        return { response, data, responseText };
    } catch (error: any) {
        // Se houver erro de rede no proxy, tenta o próximo
        if (proxyIndex < FALLBACK_PROXIES.length - 1) {
            console.warn(`Proxy ${proxyUrl} unreachable. Trying next fallback...`);
            return executeRequest(settings, targetUrl, method, headers, body, proxyIndex + 1);
        }
        console.error("Network/Proxy Error:", error);
        throw new Error(`Falha de rede ou todos os proxies falharam. Detalhes: ${error.message}`);
    }
};

const executeRequestWithRateLimit = async (settings: AppSettings, targetUrl: string, method: string, headers: any, body?: any, retryCount = 0): Promise<any> => {
    // Garante intervalo mínimo entre requisições
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        await sleep(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
    }
    lastRequestTime = Date.now();

    const result = await executeRequest(settings, targetUrl, method, headers, body);
    
    // Tratamento de Too Many Requests (429)
    if (result.response.status === 429 && retryCount < 3) {
        const waitTime = Math.pow(2, retryCount) * 2000; // Backoff exponencial: 2s, 4s, 8s
        console.warn(`SGA API Rate Limited (429). Retrying in ${waitTime}ms...`);
        await sleep(waitTime);
        return executeRequestWithRateLimit(settings, targetUrl, method, headers, body, retryCount + 1);
    }

    return result;
};

const authenticate = async (settings: AppSettings): Promise<string> => {
    if (!settings.hinovaToken || !settings.hinovaUser || !settings.hinovaPass) {
        throw new Error("CONFIG_INCOMPLETE: Verifique Token SGA, Usuário e Senha nas configurações.");
    }

    const baseUrl = (settings.hinovaUrl || 'https://api.hinova.com.br/api/sga/v2').replace(/\/$/, '');
    const authUrl = `${baseUrl}/usuario/autenticar`;

    try {
        const { response, data, responseText } = await executeRequestWithRateLimit(
            settings,
            authUrl,
            'POST',
            {
                'Content-Type': 'application/json',
                'Authorization': formatBearerToken(settings.hinovaToken)
            },
            { 
                usuario: settings.hinovaUser.trim(), 
                senha: settings.hinovaPass.trim() 
            }
        );

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) throw new Error("AUTH_INVALID: Credenciais SGA inválidas.");
            if (responseText.toLowerCase().includes("timeout")) throw new Error("TIMEOUT: O servidor Hinova demorou a responder.");
            throw new Error(data.error || data.mensagem || `ERRO_${response.status}: Falha na autenticação SGA.`);
        }

        if (!data.token_usuario) throw new Error("TOKEN_MISSING: Autenticação aceita, mas SGA não gerou token.");
        return data.token_usuario;
    } catch (e: any) {
        console.error("Hinova Auth Error:", e);
        throw new Error(`Falha na Autenticação Hinova: ${e.message}`);
    }
};

const getToken = async (settings: AppSettings): Promise<string> => {
    if (cachedUserToken) return cachedUserToken;
    if (!authPromise) {
        authPromise = authenticate(settings).then(token => {
            cachedUserToken = token;
            authPromise = null;
            return token;
        }).catch(err => {
            authPromise = null;
            cachedUserToken = null;
            throw err;
        });
    }
    return authPromise;
};

export const hinovaService = {
  searchVehicle: async (plateOrChassis: string): Promise<{ vehicle: Partial<Vehicle>, client: Partial<Client>, price?: string } | null> => {
    const query = plateOrChassis.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (query.length < 7) throw new Error("INVALID_INPUT: Informe ao menos 7 caracteres.");

    // 1. Verificar Cache
    const cached = searchCache.get(query);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }

    // 2. Deduplicação de Requisições (Race Condition)
    if (searchPromises.has(query)) {
        return searchPromises.get(query);
    }

    const searchPromise = (async () => {
        const settings = await storage.getSettings();
        let userToken = await getToken(settings);
        const baseUrl = (settings.hinovaUrl || 'https://api.hinova.com.br/api/sga/v2').replace(/\/$/, '');
        const typeSearch = query.length === 7 ? 'placa' : 'chassi'; 
        const targetUrl = `${baseUrl}/veiculo/buscar/${query}/${typeSearch}`;
        
        try {
            const { response, data, responseText } = await executeRequestWithRateLimit(
                settings,
                targetUrl,
                'GET',
                { 
                    'Content-Type': 'application/json', 
                    'Authorization': formatBearerToken(userToken) 
                }
            );

            if (!response.ok) {
                if (response.status === 401) {
                    cachedUserToken = null;
                    // Retry once with fresh token
                    const newToken = await authenticate(settings);
                    cachedUserToken = newToken;
                    // Limpa a promessa atual para permitir o retry
                    searchPromises.delete(query);
                    return hinovaService.searchVehicle(plateOrChassis);
                }
                throw new Error(data.error || data.mensagem || "ERRO_BUSCA: Falha na comunicação com SGA.");
            }

            if (!Array.isArray(data) || data.length === 0) {
                searchCache.set(query, { data: null, timestamp: Date.now() });
                return null;
            }

            const item = data[0];
            const categories = await storage.getCategories();
            let targetFipeType = 'carros';
            const hinovaType = (item.tipo || '').toUpperCase();
            if (hinovaType.includes('MOTO') || hinovaType.includes('CICL')) targetFipeType = 'motos';
            else if (hinovaType.includes('CAMIN') || hinovaType.includes('TRUCK')) targetFipeType = 'caminhoes';
            
            const matchedCategory = categories.find(c => c.fipeType === targetFipeType) || categories[0];

            const result = {
                client: {
                    name: item.nome,
                    cpf: String(item.cpf || ''),
                    phone: item.telefone_celular ? `(${item.ddd_celular}) ${item.telefone_celular}` : (item.telefone ? `(${item.ddd}) ${item.telefone}` : ''),
                    email: item.email,
                    address: `${item.logradouro}, ${item.numero} - ${item.bairro}`,
                    city: item.cidade, state: item.estado, createdAt: Date.now()
                },
                vehicle: {
                    plate: item.placa, chassis: item.chassi, model: `${item.marca} ${item.modelo}`,
                    year: item.ano_modelo, fipeCode: item.codigo_fipe, hinovaId: item.codigo_veiculo,
                    type: matchedCategory.id, status: 'active' as const
                },
                price: item.valor_fipe ? String(item.valor_fipe) : undefined
            };

            // Salva no cache
            searchCache.set(query, { data: result, timestamp: Date.now() });
            return result;
        } catch (e: any) {
            throw new Error(`Falha na Busca Hinova: ${e.message}`);
        } finally {
            // Remove da lista de promessas ativas
            searchPromises.delete(query);
        }
    })();

    searchPromises.set(query, searchPromise);
    return searchPromise;
  }
};
