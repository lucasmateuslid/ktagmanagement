
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

export const hinovaService = {
  searchVehicle: async (plateOrChassis: string): Promise<{ vehicle: Partial<Vehicle>, client: Partial<Client> } | null> => {
    const settings = await storage.getSettings();

    // 1. Validation: Ensure Proxy is Configured
    // Hinova strictly blocks browser requests. We must use the Cloud Function.
    if (!settings.customProxyUrl) {
        throw new Error("Configuração Necessária: A API da Hinova bloqueia navegadores. Vá em 'Configurações' e preencha o campo 'URL da Cloud Function (Firebase)' com a URL que você gerou.");
    }

    if (!settings.hinovaToken) {
      throw new Error("Token da Hinova não configurado. Vá em Configurações.");
    }

    // 2. Prepare Data
    const baseUrl = (settings.hinovaUrl || 'https://api.hinova.com.br/api/sga/v2').replace(/\/$/, '');
    const query = plateOrChassis.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const type = query.length === 7 ? 'PLACA' : 'CHASSI'; 
    const targetUrl = `${baseUrl}/veiculo/buscar/${query}/${type}`;

    // Token Cleaning
    let rawToken = settings.hinovaToken.trim();
    if ((rawToken.startsWith('"') && rawToken.endsWith('"')) || (rawToken.startsWith("'") && rawToken.endsWith("'"))) {
        rawToken = rawToken.substring(1, rawToken.length - 1);
    }
    const tokenFinal = rawToken.toLowerCase().startsWith('bearer ') ? rawToken : `Bearer ${rawToken}`;

    // 3. Execute Request via Cloud Function Proxy
    // We do NOT try direct fetch here to avoid "Blocked by CORS" console errors.
    try {
        console.log(`[Hinova] Buscando via Proxy: ${settings.customProxyUrl}`);
        
        const response = await fetch(settings.customProxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: targetUrl,
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': tokenFinal
                    // REMOVED: 'Content-Type': 'application/json' (GET requests shouldn't have content-type)
                }
            })
        });

        // 4. Handle Proxy-Specific Errors
        if (!response.ok) {
            let errorText = await response.text();
            try {
                 // Try to parse JSON error if available
                 const jsonError = JSON.parse(errorText);
                 if (jsonError.error) errorText = jsonError.error;
            } catch (e) {}

            if (response.status === 401) {
                 console.error("Hinova 401:", errorText);
                 throw new Error("Erro de Autenticação (401). Verifique se o Token da Hinova nas configurações está correto e ativo.");
            }
            if (response.status === 500) {
                 throw new Error(`Erro no Servidor Proxy: ${errorText}`);
            }
            throw new Error(`Erro na API Hinova (${response.status}): ${errorText}`);
        }

        // 5. Parse Data
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
        // Clean up error message for UI
        const msg = e.message || "Erro desconhecido";
        if (msg.includes("Failed to fetch")) {
            throw new Error("Falha de conexão com a Cloud Function. Verifique a URL do Proxy nas configurações.");
        }
        throw new Error(msg);
    }
  }
};
