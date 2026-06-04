
// Real Service for Plate Lookup
import { storage } from './storage';
import { VehicleCategory } from '../types';

export interface PlateResult {
  plate: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  chassis?: string;
  fipeCode?: string;
  found: boolean;
  suggestedCategoryId?: string; // ID of the category in our system
}

export const plateLookupService = {
  lookup: async (plate: string): Promise<PlateResult | null> => {
    const settings = await storage.getSettings();
    const cleanPlate = plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    if (cleanPlate.length !== 7) {
      throw new Error("Invalid plate format. Must be 7 characters.");
    }

    if (!settings.plateApiUrl) {
       throw new Error("API de Placas não configurada em Configurações.");
    }

    // Replace {plate} placeholder in the URL
    const url = settings.plateApiUrl.replace('{plate}', cleanPlate);
    
    // Prepare headers if token is present
    const headers: Record<string, string> = {
        'Accept': 'application/json'
    };
    if (settings.plateApiToken) {
        headers['Authorization'] = `Bearer ${settings.plateApiToken}`; // Common format, might vary by provider
    }

    try {
        const response = await fetch(url, { method: 'GET', headers });
        
        if (!response.ok) {
            if (response.status === 404) return { plate: cleanPlate, brand:'', model:'', year:'', color:'', found: false };
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        
        // --- ADAPTER LOGIC ---
        // Adapts generic JSON response to our app structure.
        // Assumes common fields (marca, modelo, ano, extra.tipo_veiculo, etc.)
        
        // Note: Field names depend on the provider. Adjust these accessors based on your actual API.
        const brand = data.marca || data.brand || 'Unknown';
        const model = data.modelo || data.model || 'Unknown';
        const year = data.ano || data.anoModelo || data.year || '';
        const color = data.cor || data.color || '';
        const fipe = data.fipe_codigo || data.codigoFipe || '';
        const rawType = (data.tipo_veiculo || data.extra?.tipo_veiculo || data.segmento || '').toString().toLowerCase();

        // --- INTELLIGENT CATEGORY MAPPING ---
        const categories = await storage.getCategories();
        let matchedCatId = '';

        // Heuristics to find category ID
        if (rawType.includes('moto') || rawType.includes('ciclo') || model.toLowerCase().includes('honda cg')) {
            matchedCatId = categories.find(c => c.name.toLowerCase().includes('moto'))?.id || '';
        } else if (rawType.includes('caminh') || rawType.includes('truck') || rawType.includes('reboque')) {
            matchedCatId = categories.find(c => c.name.toLowerCase().includes('caminh'))?.id || '';
        } else {
             // Default to Car if likely
             matchedCatId = categories.find(c => c.name.toLowerCase().includes('carro') || c.name.toLowerCase().includes('passeio'))?.id || '';
        }

        return {
            plate: cleanPlate,
            brand,
            model: `${brand} ${model}`,
            year: year.toString(),
            color,
            fipeCode: fipe,
            found: true,
            suggestedCategoryId: matchedCatId
        };

    } catch (e: any) {
        console.error("Plate Lookup Error:", e);
        throw new Error(e.message || "Failed to connect to Plate API");
    }
  }
};
