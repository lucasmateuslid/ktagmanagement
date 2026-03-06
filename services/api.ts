
import { Tag, KTagLocationResult, KTagBatteryInfo } from '../types';
import { storage } from './storage';
import { xadtagService } from './xadtag';

// K-Tag API v1.2 (2025-11-06)
// status field now represents battery level
// This logic is shared between map and inventory views
export const ktagBatteryStatus = (status?: number): KTagBatteryInfo => {
  switch (status) {
    case 0:
      return { level: 100, label: 'Normal', color: '#10b981' }; // Green
    case 1:
      return { level: 60, label: 'Médio', color: '#eab308' }; // Yellow
    case 2:
      return { level: 30, label: 'Baixo', color: '#f97316' }; // Orange
    case 3:
      return { level: 10, label: 'Muito baixo', color: '#ef4444' }; // Red
    default:
      return { level: 0, label: 'Desconhecido', color: '#71717a' }; // Gray
  }
};

/**
 * Busca localizações em lote com controle de concorrência e resiliência a rate limits (429).
 */
export const fetchTagsLocationBatch = async (tags: Tag[], chunkSize = 10): Promise<KTagLocationResult[]> => {
  const allResults: KTagLocationResult[] = [];
  
  for (let i = 0; i < tags.length; i += chunkSize) {
    const chunk = tags.slice(i, i + chunkSize);
    
    const chunkResults = await Promise.all(chunk.map(async (tag) => {
      // Tenta buscar a localização com até 2 retentativas em caso de 429
      let attempts = 0;
      const maxAttempts = 2;
      
      while (attempts <= maxAttempts) {
        try {
          const res = await fetchTagLocation(tag);
          return res.length > 0 ? { ...res[0], tagId: tag.id } : null;
        } catch (e: any) {
          if (e.message.includes('429') && attempts < maxAttempts) {
            attempts++;
            // Espera exponencial: 1s, 2s...
            await new Promise(resolve => setTimeout(resolve, attempts * 1000));
            continue;
          }
          console.error(`Erro ao rastrear tag ${tag.accessoryId}:`, e.message);
          return null;
        }
      }
      return null;
    }));

    const validResults = chunkResults.filter((r): r is any => r !== null);
    allResults.push(...validResults);

    // Aumenta o delay entre chunks para 500ms para respeitar os limites do Proxy
    if (tags.length > chunkSize) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return allResults;
};

export const fetchTagLocation = async (tag: Tag): Promise<KTagLocationResult[]> => {
  // Dispatcher Baseado no Tipo de Dispositivo
  if (tag.type === 'XADTAG') {
      return xadtagService.fetchLocation(tag);
  }

  // Lógica Legada K-TAG
  const settings = await storage.getSettings();
  const payload = {
    accessoryId: tag.accessoryId,
    hashed_keys: [tag.hashedAdvKey], 
    priv_keys: [tag.privateKey],     
  };

  const authHeader = `Basic ${btoa(`${settings.ktagUser}:${settings.ktagPass}`)}`;
  
  if (settings.customProxyUrl) {
    try {
      const response = await fetch(settings.customProxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: settings.ktagUrl,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
          body: payload
        })
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error("Acesso Negado (401): Credenciais K-Tag inválidas.");
        if (response.status === 404) throw new Error("Endpoint K-Tag não encontrado (404).");
        if (response.status === 429) throw new Error("Erro 429: Muitas requisições. O servidor está limitando o acesso.");
        throw new Error(`Erro ${response.status}: Falha no Proxy K-Tag.`);
      }
      
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        
        // Parse da Resposta conforme K-Tag API v1.2
        if (data && Array.isArray(data.results)) {
            return data.results.map((p: any) => ({
                lat: p.lat,
                lon: p.lon,
                conf: p.conf,
                status: p.status, // Raw status
                battery: ktagBatteryStatus(p.status), // New interpreted battery
                timestamp: p.timestamp, // Already in ms
                isodatetime: p.isodatetime
            }));
        }
        
        return [];
      } catch (jsonErr) {
        throw new Error("Resposta inválida do servidor K-Tag.");
      }
    } catch (e: any) {
      throw new Error(e.message || "Erro de conexão com o servidor de rastreio.");
    }
  }

  throw new Error("Proxy não configurado. Impossível realizar rastreio.");
};

export const exportToCSV = (locations: KTagLocationResult[]) => {
  const headers = ['Timestamp', 'ISO Date', 'Latitude', 'Longitude', 'Confidence', 'Battery Level', 'Battery Label'];
  const rows = locations.map(l => [
      l.timestamp, 
      l.isodatetime, 
      l.lat, 
      l.lon, 
      l.conf, 
      l.battery.level, 
      l.battery.label
  ].join(','));
  
  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `rastreio_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
