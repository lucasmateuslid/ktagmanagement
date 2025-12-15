
import { storage } from './storage';
import { Vehicle, Client, AppSettings } from '../types';

// Interface atualizada baseada no JSON fornecido
interface HinovaResponseItem {
  codigo_veiculo: string;
  placa: string;
  chassi: string;
  codigo_fipe: string;
  ano_fabricacao: string;
  ano_modelo: string; // Usar este para o Ano
  renavam: string;
  tipo: string; // AUTOMÓVEL, MOTOCICLETA, etc.
  categoria: string;
  marca: string;
  modelo: string;
  codigo_cor: string;
  // Dados do Cliente
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
    let userToken: string;
    try {
        userToken = await getToken(settings);
    } catch (authError: any) {
        throw new Error(`Erro Login Hinova: ${authError.message}`);
    }

    // 3. Prepare Data
    const baseUrl = (settings.hinovaUrl || 'https://api.hinova.com.br/api/sga/v2').replace(/\/$/, '');
    const query = plateOrChassis.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const typeSearch = query.length === 7 ? 'placa' : 'chassi'; 
    const targetUrl = `${baseUrl}/veiculo/buscar/${query}/${typeSearch}`;
    
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

        // --- DETECÇÃO AUTOMÁTICA DE CATEGORIA ---
        const categories = await storage.getCategories();
        let targetFipeType = 'carros'; // Padrão
        
        const hinovaType = (item.tipo || '').toUpperCase();
        
        if (hinovaType.includes('MOTO') || hinovaType.includes('CICL')) {
            targetFipeType = 'motos';
        } else if (hinovaType.includes('CAMIN') || hinovaType.includes('TRUCK')) {
            targetFipeType = 'caminhoes';
        }
        
        // Encontra o ID da categoria no sistema K-Tag que corresponde ao tipo detectado
        const matchedCategory = categories.find(c => c.fipeType === targetFipeType) 
                             || categories.find(c => c.fipeType === 'carros')
                             || categories[0];

        const categoryId = matchedCategory ? matchedCategory.id : 'cat-car';

        // Format Phone
        const phone = item.telefone_celular 
            ? `(${item.ddd_celular}) ${item.telefone_celular}` 
            : (item.telefone ? `(${item.ddd}) ${item.telefone}` : '');

        // Map to Client
        const client: Partial<Client> = {
            name: item.nome,
            cpf: item.cpf,
            phone: phone,
            email: item.email,
            address: `${item.logradouro}, ${item.numero} - ${item.bairro}`,
            city: item.cidade,
            state: item.estado,
            createdAt: Date.now()
        };

        // Map to Vehicle
        const vehicle: Partial<Vehicle> = {
            plate: item.placa,
            chassis: item.chassi,
            model: `${item.marca} ${item.modelo}`, // Concatena Marca e Modelo
            year: item.ano_modelo, // Usa ano_modelo conforme solicitado
            fipeCode: item.codigo_fipe,
            hinovaId: item.codigo_veiculo,
            type: categoryId, // Define automaticamente se é Moto ou Carro
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
