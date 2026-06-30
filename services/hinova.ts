
import { storage } from './storage';
import { Vehicle, Client, AppSettings, Company } from '../types';

const tokenCache: Record<string, { token: string, expires: number }> = {};
const authPromises: Record<string, Promise<string> | null> = {};

// Cache e Deduplicação de buscas
const searchPromises = new Map<string, Promise<any>>();
const searchCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutos de cache

// Controle de concorrência e rate limit (Por Token/Tenant)
const lastRequestTimeByToken = new Map<string, number>();
const MIN_REQUEST_INTERVAL = 300; // 300ms entre requisições por token para evitar 429

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
    const tokenKey = headers['Authorization'] || 'default';

    // Garante intervalo mínimo entre requisições (fila pseudo-atômica por token)
    const now = Date.now();
    const lastRequest = lastRequestTimeByToken.get(tokenKey) || 0;
    
    let waitTimeForLimit = 0;
    if (now - lastRequest < MIN_REQUEST_INTERVAL) {
        waitTimeForLimit = MIN_REQUEST_INTERVAL - (now - lastRequest);
    }
    
    // Reserva o timestamp para a próxima requisição
    lastRequestTimeByToken.set(tokenKey, now + waitTimeForLimit);

    if (waitTimeForLimit > 0) {
        await sleep(waitTimeForLimit);
    }

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

const authenticateCompany = async (settings: AppSettings, comp: Company): Promise<string> => {
    const sgaToken = comp.sgaToken || settings.hinovaToken;
    const sgaUser = comp.sgaUser || settings.hinovaUser;
    const sgaPass = comp.sgaPass || settings.hinovaPass;
    const sgaUrl = comp.sgaUrl || settings.hinovaUrl || 'https://api.hinova.com.br/api/sga/v2';

    if (!sgaToken || !sgaUser || !sgaPass) {
        throw new Error(`CONFIG_INCOMPLETE: SGA Config is missing for company ${comp.name}`);
    }

    const baseUrl = sgaUrl.replace(/\/$/, '');
    const authUrl = `${baseUrl}/usuario/autenticar`;

    try {
        const { response, data, responseText } = await executeRequestWithRateLimit(
            settings,
            authUrl,
            'POST',
            {
                'Content-Type': 'application/json',
                'Authorization': formatBearerToken(sgaToken)
            },
            { 
                usuario: sgaUser.trim(), 
                senha: sgaPass.trim() 
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
        console.error("Hinova Auth Error for", comp.name, e);
        throw new Error(`Falha na Autenticação Hinova (${comp.name}): ${e.message}`);
    }
};

const getTokenForCompany = async (settings: AppSettings, comp: Company): Promise<string> => {
    const cacheKey = comp.id;
    const cached = tokenCache[cacheKey];
    if (cached && cached.expires > Date.now()) {
        return cached.token;
    }
    if (!authPromises[cacheKey]) {
        authPromises[cacheKey] = authenticateCompany(settings, comp).then(token => {
            tokenCache[cacheKey] = { token, expires: Date.now() + 1000 * 60 * 50 }; // 50 mins
            authPromises[cacheKey] = null;
            return token;
        }).catch(err => {
            authPromises[cacheKey] = null;
            delete tokenCache[cacheKey];
            throw err;
        });
    }
    return authPromises[cacheKey] as Promise<string>;
};

const trySearchInCompany = async (settings: AppSettings, comp: Company, query: string): Promise<any | null> => {
    const sgaUrl = comp.sgaUrl || settings.hinovaUrl || 'https://api.hinova.com.br/api/sga/v2';
    try {
        let userToken = await getTokenForCompany(settings, comp);
        const baseUrl = sgaUrl.replace(/\/$/, '');
        const typeSearch = query.length === 7 ? 'placa' : 'chassi'; 
        const targetUrl = `${baseUrl}/veiculo/buscar/${query}/${typeSearch}`;
        
        let { response, data } = await executeRequestWithRateLimit(
            settings, targetUrl, 'GET',
            { 'Content-Type': 'application/json', 'Authorization': formatBearerToken(userToken) }
        );

        if (!response.ok) {
            if (response.status === 401) {
                delete tokenCache[comp.id];
                userToken = await getTokenForCompany(settings, comp);
                const retry = await executeRequestWithRateLimit(
                    settings, targetUrl, 'GET',
                    { 'Content-Type': 'application/json', 'Authorization': formatBearerToken(userToken) }
                );
                response = retry.response;
                data = retry.data;
            } else {
                return null;
            }
        }

        if (response.ok && Array.isArray(data) && data.length > 0) {
            return { item: data[0], company: comp };
        }
        return null;
    } catch (error) {
        console.warn(`Failed searching in company ${comp.name}:`, error);
        return null;
    }
};

export const hinovaService = {
  searchVehicle: async (plateOrChassis: string): Promise<{ vehicle: Partial<Vehicle>, client: Partial<Client>, price?: string, companyId?: string } | null> => {
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
        const companies = await storage.getCompanies();
        const sgaCompanies = companies.filter(c => c.hasSgaIntegration !== false);
        
        const validCompanies = sgaCompanies.filter(comp => comp.sgaToken || settings.hinovaToken);
        
        let matchedResult = await new Promise<any>((resolve) => {
            if (validCompanies.length === 0) return resolve(null);
            
            let pendingCount = validCompanies.length;
            let resolved = false;

            validCompanies.forEach(comp => {
                trySearchInCompany(settings, comp, query)
                    .then(result => {
                        if (resolved) return;
                        if (result) {
                            resolved = true;
                            resolve(result);
                        } else {
                            pendingCount--;
                            if (pendingCount === 0) resolve(null);
                        }
                    })
                    .catch(err => {
                        if (resolved) return;
                        pendingCount--;
                        if (pendingCount === 0) resolve(null);
                    });
            });
        });
        
        if (!matchedResult) {
            searchCache.set(query, { data: null, timestamp: Date.now() });
            throw new Error(`Veículo não encontrado nas APIs SGA (pesquisados ${validCompanies.length} tokens).`);
        }

        const { item, company } = matchedResult;
        
        const categories = await storage.getCategories();
        let targetFipeType = 'carros';
        const hinovaType = (item.tipo || '').toUpperCase();
        if (hinovaType.includes('MOTO') || hinovaType.includes('CICL')) targetFipeType = 'motos';
        else if (hinovaType.includes('CAMIN') || hinovaType.includes('TRUCK')) targetFipeType = 'caminhoes';
        
        const matchedCategory = categories.find(c => c.fipeType === targetFipeType) || categories[0];

        const hinovaColors: Record<string, string> = {
            "1": "Preto", "2": "Branco", "3": "Azul", "4": "Vermelho", "5": "Verde",
            "6": "Cinza", "7": "Bege", "8": "Amarelo", "9": "Prata", "10": "Não Especificado",
            "11": "Dourado", "12": "Laranja", "13": "Marrom", "14": "Fantasia", "15": "Roxo",
            "16": "Rosa", "19": "Teste", "20": "Preta (Mercosul) / Fantasia (Lock)",
            "21": "Preta (Mercosul) / Roxa (Lock)", "22": "Preto", "23": "Branco", "24": "Vermelho",
            "25": "Amarelo", "26": "Azul Perol", "27": "Roxo", "28": "Dourado"
        };
        
        let extractedCor = item.codigo_cor;
        let extractedSituacao = item.descricao_situacao;
        let extractedDescricaoCor = item.descricao_cor;
        
        if (item.lista_produto_vinculado && Array.isArray(item.lista_produto_vinculado) && item.lista_produto_vinculado.length > 0) {
            const prod = item.lista_produto_vinculado[0];
            if (prod.codigo_cor) extractedCor = prod.codigo_cor;
            if (prod.descricao_situacao) extractedSituacao = prod.descricao_situacao;
            if (prod.descricao_cor) extractedDescricaoCor = prod.descricao_cor;
        }

        const mappedColor = extractedCor ? hinovaColors[String(extractedCor)] : undefined;

        const result = {
            client: {
                name: item.nome,
                cpf: String(item.cpf || ''),
                phone: item.telefone_celular ? `(${item.ddd_celular}) ${item.telefone_celular}` : (item.telefone ? `(${item.ddd}) ${item.telefone}` : ''),
                email: item.email,
                address: `${item.logradouro}, ${item.numero} - ${item.bairro}`,
                city: item.cidade, state: item.estado, createdAt: Date.now(),
                clientStatus: extractedSituacao || item.situacao_associado || item.situacao_cliente || item.situacaoAssociado || item.situacaoCliente || item.situacao || '',
            },
            vehicle: {
                plate: item.placa, chassis: item.chassi, model: `${item.marca} ${item.modelo}`,
                color: extractedDescricaoCor || mappedColor || item.cor_veiculo || item.cor_do_veiculo || item.corVeiculo || item.cor || '',
                vehicleStatus: extractedSituacao || item.situacao_veiculo || item.situacao_do_veiculo || item.situacaoVeiculo || item.situacao || '',
                year: item.ano_modelo, fipeCode: item.codigo_fipe, hinovaId: item.codigo_veiculo,
                type: matchedCategory ? matchedCategory.id : '', status: 'active' as const,
                companyId: company.id
            },
            price: item.valor_fipe ? String(item.valor_fipe) : undefined,
            companyId: company.id
        };

        // Salva no cache
        searchCache.set(query, { data: result, timestamp: Date.now() });
        return result;
    })();

    searchPromises.set(query, searchPromise);
    return searchPromise;
  }
};
