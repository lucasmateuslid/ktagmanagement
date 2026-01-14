
import { Tag, KTagLocationResult } from '../types';
import { storage } from './storage';
import { xadtagService } from './xadtag';

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
        throw new Error(`Erro ${response.status}: Falha no Proxy K-Tag.`);
      }
      
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        return data?.results || [];
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
  const headers = ['Timestamp', 'ISO Date', 'Latitude', 'Longitude', 'Confidence', 'Status'];
  const rows = locations.map(l => [l.timestamp, l.isodatetime, l.lat, l.lon, l.conf, l.status].join(','));
  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `rastreio_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
