
import { Tag, KTagLocationResult, KTagBatteryInfo } from '../types';
import { storage } from './storage';
import { xadtagService } from './xadtag';
import { securityService } from './security';

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
    // Validate HTTPS before making request
    if (!securityService.validateSecureUrl(settings.customProxyUrl)) {
      throw new Error('Security Error: API calls require HTTPS connection');
    }
    
    if (!securityService.validateSecureUrl(settings.ktagUrl)) {
      throw new Error('Security Error: K-Tag API URL must use HTTPS');
    }
    
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
