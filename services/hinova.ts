
import { storage } from './storage';
import { Vehicle, Client, AppSettings } from '../types';

interface HinovaResponseItem {
  codigo_veiculo: string;
  placa: string;
  chassi: string;
  codigo_fipe: string;
  ano_fabricacao: string;
  ano_modelo: string;
  renavam: string;
  tipo: string;
  categoria: string;
  marca: string;
  modelo: string;
  codigo_cor: string;
  // Client Data
  nome: string;
  cpf: string;
  telefone: string;
  telefone_celular: string;
  email: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  descricao_situacao: string;
}

// In-memory cache for the user token to avoid re-authenticating on every request
let cachedUserToken: string | null = null;
let authPromise: Promise<string> | null = null;

// Helper to clean tokens (remove quotes)
const cleanToken = (token: string) => {
    let raw = token.trim();
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
        raw = raw.substring(1, raw.length - 1);
    }
    return raw;
};

// Internal function to authenticate
const authenticate = async (settings: AppSettings): Promise<string> => {
    if (!settings.hinovaToken || !settings.hinovaUser || !settings.hinovaPass) {
        throw new Error("Credenciais Hinova incompletas. Vá em Configurações e preencha Token SGA, Usuário e Senha.");
    }

    const baseUrl = (settings.hinovaUrl || 'https://api.hinova.com.br/api/sga/v2').replace(/\/$/, '');
    const authUrl = `${baseUrl}/usuario/autenticar`;
    const sgaToken = `Bearer ${cleanToken(settings.hinovaToken)}`;

    console.log("[Hinova] Autenticando usuário...");

    const response = await fetch(settings.customProxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url: authUrl,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': sgaToken
            },
            body: {
                usuario: settings.hinovaUser,
                senha: settings.hinovaPass
            }
        })
    });

    if (!response.ok) {
         let errText = await response.text();
         try { const j = JSON.parse(errText); if(j.error) errText = j.error; } catch(e){}
         throw new Error(`Falha na Autenticação Hinova: ${errText}`);
    }

    const data = await response.json();
    if (!data.token_usuario) {
        throw new Error("Resposta de autenticação inválida (token_usuario ausente).");
    }

    console.log("[Hinova] Autenticado com sucesso.");
    return data.token_usuario;
};

// Singleton-like access to token
const getToken = async (settings: AppSettings): Promise<string> => {
    if (cachedUserToken) return cachedUserToken;
    
    // Prevent multiple parallel auth requests
    if (!authPromise) {
        authPromise = authenticate(settings).then(token => {
            cachedUserToken = token;
            authPromise = null;
            return token;
        }).catch(err => {
            authPromise = null;
            throw err;
        });
    }
    return authPromise;
};

export const hinovaService = {
  searchVehicle: async (plateOrChassis: string): Promise<{ vehicle: Partial<Vehicle>, client: Partial<Client> } | null> => {
    const settings = await storage.getSettings();

    // 1. Validation
    if (!settings.customProxyUrl) {
        throw new Error("Proxy Cloud Function não configurado.");
    }

    // 2. Authentication (Lazy)
    // We get the dynamic user token here.
    let userToken: string;
    try {
        userToken = await getToken(settings);
    } catch (authError: any) {
        throw new Error(`Erro Login Hinova: ${authError.message}`);
    }

    // 3. Prepare Data
    const baseUrl = (settings.hinovaUrl || 'https://api.hinova.com.br/api/sga/v2').replace(/\/$/, '');
    const query = plateOrChassis.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const type = query.length === 7 ? 'PLACA' : 'CHASSI'; 
    const targetUrl = `${baseUrl}/veiculo/buscar/${query}/${type}`;
    
    // Ensure token format
    const finalToken = `Bearer ${cleanToken(userToken)}`;

    // 4. Execute Request via Cloud Function Proxy
    try {
        console.log(`[Hinova] Buscando veículo: ${query}`);
        
        const response = await fetch(settings.customProxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: targetUrl,
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': finalToken
                }
            })
        });

        // 5. Handle Errors
        if (!response.ok) {
            let errorText = await response.text();
            try { const jsonError = JSON.parse(errorText); if (jsonError.error) errorText = jsonError.error; } catch (e) {}

            if (response.status === 401) {
                 // Token expired? Clear cache and retry once could be implemented here, 
                 // but for now let's just error out and clear cache for next try.
                 cachedUserToken = null;
                 throw new Error("Sessão Hinova expirada. Tente novamente.");
            }
            throw new Error(`Erro API Hinova (${response.status}): ${errorText}`);
        }

        // 6. Parse Data
        const data: HinovaResponseItem[] = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            return null; // Not found
        }

        const item = data[0];

        // Map to Client
        const client: Partial<Client> = {
            name: item.nome,
            cpf: item.cpf,
            phone: item.telefone_celular || item.telefone,
            email: item.email,
            address: `${item.logradouro}, ${item.numero}, ${item.bairro}`,
            city: item.cidade,
            state: item.estado,
            createdAt: Date.now()
        };

        // Map to Vehicle
        const vehicle: Partial<Vehicle> = {
            plate: item.placa,
            chassis: item.chassi,
            model: `${item.marca} ${item.modelo}`,
            year: item.ano_modelo,
            fipeCode: item.codigo_fipe,
            hinovaId: item.codigo_veiculo,
            status: item.descricao_situacao === 'ATIVO' ? 'active' : 'maintenance'
        };

        return { vehicle, client };

    } catch (e: any) {
        console.error("Hinova Service Error:", e);
        const msg = e.message || "Erro desconhecido";
        if (msg.includes("Failed to fetch")) {
            throw new Error("Falha de conexão com o Proxy.");
        }
        throw new Error(msg);
    }
  }
};
