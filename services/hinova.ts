
import { storage } from './storage';
import { Vehicle, Client, AppSettings } from '../types';

let cachedUserToken: string | null = null;
let authPromise: Promise<string> | null = null;

const formatBearerToken = (token: string) => {
    if (!token) return '';
    let raw = token.trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '');
    return `Bearer ${raw}`;
};

const executeRequest = async (settings: AppSettings, targetUrl: string, method: string, headers: any, body?: any) => {
    const proxyUrl = settings.customProxyUrl;
    
    let fetchUrl = targetUrl;
    let fetchOptions: RequestInit = {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    };

    // Se houver um proxy configurado
    if (proxyUrl) {
        if (proxyUrl.includes('corsproxy.io') || proxyUrl.includes('cors-anywhere') || proxyUrl.endsWith('?') || proxyUrl.endsWith('=')) {
            // Proxies públicos baseados em querystring
            fetchUrl = proxyUrl.endsWith('?') || proxyUrl.endsWith('=') 
                ? `${proxyUrl}${encodeURIComponent(targetUrl)}` 
                : `${proxyUrl}?${encodeURIComponent(targetUrl)}`;
        } else {
            // Proxy customizado (ex: Firebase Functions)
            fetchUrl = proxyUrl;
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
    } else {
        // Fallback para corsproxy.io se nenhum proxy for informado
        fetchUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
    }

    try {
        const response = await fetch(fetchUrl, fetchOptions);
        const responseText = await response.text();
        
        let data: any;
        try { 
            data = JSON.parse(responseText); 
        } catch (e) { 
            data = { error: responseText }; 
        }

        return { response, data, responseText };
    } catch (error: any) {
        console.error("Network/Proxy Error:", error);
        throw new Error(`Falha de rede ou proxy indisponível. Verifique sua conexão ou a URL do proxy. Detalhes: ${error.message}`);
    }
};

const authenticate = async (settings: AppSettings): Promise<string> => {
    if (!settings.hinovaToken || !settings.hinovaUser || !settings.hinovaPass) {
        throw new Error("CONFIG_INCOMPLETE: Verifique Token SGA, Usuário e Senha nas configurações.");
    }

    const baseUrl = (settings.hinovaUrl || 'https://api.hinova.com.br/api/sga/v2').replace(/\/$/, '');
    const authUrl = `${baseUrl}/usuario/autenticar`;

    try {
        const { response, data, responseText } = await executeRequest(
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
    const settings = await storage.getSettings();

    const query = plateOrChassis.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (query.length < 7) throw new Error("INVALID_INPUT: Informe ao menos 7 caracteres.");

    let userToken = await getToken(settings);
    const baseUrl = (settings.hinovaUrl || 'https://api.hinova.com.br/api/sga/v2').replace(/\/$/, '');
    const typeSearch = query.length === 7 ? 'placa' : 'chassi'; 
    const targetUrl = `${baseUrl}/veiculo/buscar/${query}/${typeSearch}`;
    
    try {
        const { response, data, responseText } = await executeRequest(
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
                // Retry once
                const newToken = await authenticate(settings);
                cachedUserToken = newToken;
                return hinovaService.searchVehicle(plateOrChassis);
            }
            throw new Error(data.error || data.mensagem || "ERRO_BUSCA: Falha na comunicação com SGA.");
        }

        if (!Array.isArray(data) || data.length === 0) return null;

        const item = data[0];
        const categories = await storage.getCategories();
        let targetFipeType = 'carros';
        const hinovaType = (item.tipo || '').toUpperCase();
        if (hinovaType.includes('MOTO') || hinovaType.includes('CICL')) targetFipeType = 'motos';
        else if (hinovaType.includes('CAMIN') || hinovaType.includes('TRUCK')) targetFipeType = 'caminhoes';
        
        const matchedCategory = categories.find(c => c.fipeType === targetFipeType) || categories[0];

        return {
            client: {
                name: item.nome,
                cpf: item.cpf,
                phone: item.telefone_celular ? `(${item.ddd_celular}) ${item.telefone_celular}` : (item.telefone ? `(${item.ddd}) ${item.telefone}` : ''),
                email: item.email,
                address: `${item.logradouro}, ${item.numero} - ${item.bairro}`,
                city: item.cidade, state: item.estado, createdAt: Date.now()
            },
            vehicle: {
                plate: item.placa, chassis: item.chassi, model: `${item.marca} ${item.modelo}`,
                year: item.ano_modelo, fipeCode: item.codigo_fipe, hinovaId: item.codigo_veiculo,
                type: matchedCategory.id, status: 'active'
            },
            price: item.valor_fipe
        };
    } catch (e: any) {
        throw new Error(`Falha na Busca Hinova: ${e.message}`);
    }
  }
};
