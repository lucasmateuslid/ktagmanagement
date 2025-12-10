
import { storage } from './storage';
import { Vehicle, Client } from '../types';

interface HinovaResponseItem {
  codigo_veiculo: string;
  placa: string;
  chassi: string;
  codigo_fipe: string;
  ano_fabricacao: string;
  ano_modelo: string;
  renavam: string;
  tipo: string; // ex: AUTOMÓVEL
  categoria: string; // ex: PASSEIO
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

// Fallback proxies to bypass CORS if direct connection fails
// Note: Some proxies strip headers. We prioritize those known to support Authorization headers.
const PUBLIC_PROXIES = [
    { base: 'https://corsproxy.io/?', type: 'plain' },
    { base: 'https://api.codetabs.com/v1/proxy?quest=', type: 'query' }
];

export const hinovaService = {
  searchVehicle: async (plateOrChassis: string): Promise<{ vehicle: Partial<Vehicle>, client: Partial<Client> } | null> => {
    const settings = await storage.getSettings();

    // Use default if not set, removing trailing slashes
    const baseUrl = (settings.hinovaUrl || 'https://api.hinova.com.br/api/sga/v2').replace(/\/$/, '');

    if (!settings.hinovaToken) {
      throw new Error("Token da API Hinova não configurado. Vá em Configurações.");
    }

    // Clean input
    const query = plateOrChassis.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const type = query.length === 7 ? 'PLACA' : 'CHASSI'; 

    // Construct URL: /veiculo/buscar/:placaOuChassi/:buscar_por
    const targetUrl = `${baseUrl}/veiculo/buscar/${query}/${type}`;

    // Token Cleaning: Remove whitespace and potential quotes copied by mistake
    let rawToken = settings.hinovaToken.trim();
    if ((rawToken.startsWith('"') && rawToken.endsWith('"')) || (rawToken.startsWith("'") && rawToken.endsWith("'"))) {
        rawToken = rawToken.substring(1, rawToken.length - 1);
    }

    // Ensure Bearer prefix is present exactly once
    const tokenFinal = rawToken.toLowerCase().startsWith('bearer ') 
        ? rawToken 
        : `Bearer ${rawToken}`;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Authorization': tokenFinal
    };
    
    // Helper to process response and extract data
    const handleResponse = async (response: Response) => {
        if (response.status === 401) {
            console.error("Hinova Auth Failed. Token sent:", tokenFinal.substring(0, 10) + "...");
            throw new Error("Erro de Autenticação (401). Verifique se o Token da Hinova está correto nas Configurações.");
        }

        if (!response.ok) {
            throw new Error(`Hinova API Error: ${response.status} ${response.statusText}`);
        }

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
    };

    // Strategy 1: Custom Proxy (if configured)
    if (settings.customProxyUrl) {
        try {
             const response = await fetch(settings.customProxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: targetUrl,
                    method: 'GET',
                    headers: headers
                })
             });
             return await handleResponse(response);
        } catch (e: any) {
             throw new Error(`Custom Proxy Error: ${e.message}`);
        }
    }

    // Strategy 2: Direct Fetch
    try {
        const response = await fetch(targetUrl, { 
            method: 'GET', 
            headers,
            mode: 'cors',
            referrerPolicy: 'no-referrer'
        });
        return await handleResponse(response);

    } catch (e: any) {
        console.warn("Direct Hinova fetch failed (likely CORS). Attempting fallback proxies...", e);
        
        let lastError = e;

        // Strategy 3: Public Proxies Fallback (Handles CORS automatically)
        for (const proxy of PUBLIC_PROXIES) {
            try {
                console.log(`Trying proxy: ${proxy.base}`);
                const proxyUrl = proxy.type === 'query' 
                    ? `${proxy.base}${encodeURIComponent(targetUrl)}` 
                    : `${proxy.base}${targetUrl}`;
                
                const response = await fetch(proxyUrl, {
                    method: 'GET',
                    headers: {
                        ...headers,
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
                
                // Check if proxy itself failed (some return HTML on error)
                const contentType = response.headers.get("content-type");
                if (contentType && !contentType.includes("application/json")) {
                    throw new Error("Proxy returned non-JSON response");
                }

                return await handleResponse(response);
            } catch (proxyErr: any) {
                console.warn(`Proxy ${proxy.base} failed:`, proxyErr);
                lastError = proxyErr;
            }
        }

        // Final Error Handling
        if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
             throw new Error("Erro de Conexão (CORS). O navegador bloqueou o acesso à Hinova. Todos os proxies públicos falharam. Configure o 'Cloud Function Proxy' para uma solução definitiva.");
        }
        throw new Error(lastError.message || "Falha na comunicação com Hinova");
    }
  }
};
