
import { storage } from './storage';
import { Vehicle, Client, AppSettings } from '../types';
import { securityService } from './security';

interface HinovaResponseItem {
  codigo_veiculo: string;
  placa: string;
  chassi: string;
  codigo_fipe: string;
  valor_fipe?: string;
  ano_fabricacao: string;
  ano_modelo: string;
  renavam: string;
  tipo: string;
  categoria: string;
  marca: string;
  modelo: string;
  codigo_cor: string;
  nome: string;
  cpf: string;
  telefone: string;
  ddd: string;
  telefone_celular: string;
  ddd_celular: string;
  email: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  descricao_situacao: string;
}

let cachedUserToken: string | null = null;
let authPromise: Promise<string> | null = null;

const formatBearerToken = (token: string) => {
    if (!token) return '';
    let raw = token.trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '');
    return `Bearer ${raw}`;
};

const authenticate = async (settings: AppSettings): Promise<string> => {
    if (!settings.hinovaToken || !settings.hinovaUser || !settings.hinovaPass) {
        throw new Error("CONFIG_INCOMPLETE: Verifique Token SGA, Usuário e Senha nas configurações.");
    }

    const baseUrl = (settings.hinovaUrl || 'https://api.hinova.com.br/api/sga/v2').replace(/\/$/, '');
    const authUrl = `${baseUrl}/usuario/autenticar`;

    // Validate HTTPS for security
    if (!securityService.validateSecureUrl(settings.customProxyUrl)) {
        throw new Error('SECURITY_ERROR: Proxy URL must use HTTPS');
    }
    
    if (!securityService.validateSecureUrl(authUrl)) {
        throw new Error('SECURITY_ERROR: Hinova API URL must use HTTPS');
    }

    try {
        const response = await fetch(settings.customProxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: authUrl,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': formatBearerToken(settings.hinovaToken)
                },
                body: { usuario: settings.hinovaUser.trim(), senha: settings.hinovaPass.trim() }
            })
        });

        const responseText = await response.text();
        let data: any;
        try { data = JSON.parse(responseText); } catch (e) { data = { error: responseText }; }

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) throw new Error("AUTH_INVALID: Token SGA ou Credenciais de Usuário incorretas.");
            if (responseText.toLowerCase().includes("timeout")) throw new Error("TIMEOUT: O servidor Hinova demorou a responder.");
            throw new Error(data.error || `ERRO_${response.status}: Falha na comunicação com SGA.`);
        }

        if (!data.token_usuario) throw new Error("TOKEN_MISSING: Autenticação aceita, mas SGA não gerou token de sessão.");
        return data.token_usuario;
    } catch (e: any) {
        throw e;
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
    if (!settings.customProxyUrl) throw new Error("PROXY_OFFLINE: URL do Proxy não configurada.");

    const query = plateOrChassis.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (query.length < 7) throw new Error("INVALID_INPUT: Informe ao menos 7 caracteres.");

    let userToken = await getToken(settings);
    const baseUrl = (settings.hinovaUrl || 'https://api.hinova.com.br/api/sga/v2').replace(/\/$/, '');
    const typeSearch = query.length === 7 ? 'placa' : 'chassi'; 
    const targetUrl = `${baseUrl}/veiculo/buscar/${query}/${typeSearch}`;
    
    try {
        const response = await fetch(settings.customProxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: targetUrl,
                method: 'GET',
                headers: { 'Accept': 'application/json', 'Authorization': formatBearerToken(userToken) }
            })
        });

        const responseText = await response.text();
        let data: any;
        try { data = JSON.parse(responseText); } catch (e) { data = { error: responseText }; }

        if (!response.ok) {
            if (response.status === 401) {
                cachedUserToken = null;
                // Retry once
                const newToken = await authenticate(settings);
                cachedUserToken = newToken;
                return hinovaService.searchVehicle(plateOrChassis);
            }
            if (responseText.toLowerCase().includes("timeout")) throw new Error("TIMEOUT: Servidor Hinova instável no momento.");
            throw new Error(data.error || "ERRO_BUSCA: Não foi possível localizar os dados.");
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
            price: item.valor_fipe // Retorna o valor FIPE vindo da API
        };
    } catch (e: any) {
        throw e;
    }
  }
};
