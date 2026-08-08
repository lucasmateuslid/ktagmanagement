
import { Tag, KTagLocationResult, KTagBatteryInfo } from '../types';
import { storage } from './storage';
import { xadtagService } from './xadtag';
import { trackingApi } from './trackingApi';

// K-Tag API (api.gps308.com/feibao) — campo `status` = nível de bateria.
// Doc do fornecedor v0.4: 0=极低 (muito baixo) … 3=高 (alto). ESCALA INVERTIDA
// em relação à versão antiga (que assumia 0=Normal/cheio). Compartilhado entre
// o mapa e o inventário.
export const ktagBatteryStatus = (status?: number): KTagBatteryInfo => {
  switch (status) {
    case 0:
      return { level: 10, label: 'Muito baixo', color: '#ef4444' }; // 极低 — vermelho
    case 1:
      return { level: 30, label: 'Baixo', color: '#f97316' }; // 低 — laranja
    case 2:
      return { level: 60, label: 'Médio', color: '#eab308' }; // 中 — amarelo
    case 3:
      return { level: 100, label: 'Alto', color: '#10b981' }; // 高 — verde
    default:
      return { level: 0, label: 'Desconhecido', color: '#71717a' }; // Gray
  }
};

/**
 * Verifica se a tag mudou de posição além de um limiar (≈5m por padrão).
 * Usado para registrar histórico apenas quando há movimento real, evitando
 * milhares de pontos idênticos de veículos parados.
 * - Sem posição nova: nunca registra.
 * - Sem posição anterior: registra o primeiro ponto.
 */
export const hasMoved = (
  prev?: { lat: number; lon: number } | null,
  next?: { lat: number; lon: number } | null,
  thresholdDeg = 0.00005
): boolean => {
  if (!next) return false;
  if (!prev) return true;
  return Math.abs(prev.lat - next.lat) > thresholdDeg || Math.abs(prev.lon - next.lon) > thresholdDeg;
};

/**
 * Busca localizações em lote. K-TAG usa o endpoint em LOTE do feibao (doc 3.3):
 * uma requisição para até `chunkSize` chaves, com os resultados pareados de volta
 * pela `key` (== hashedAdvKey), como exige a doc. XADTAG continua individual (API
 * distinta). Resiliente a 429 com backoff exponencial.
 *
 * Contrato de progresso preservado: onProgress(index, total, currentTag).
 */
export const fetchTagsLocationBatch = async (tags: Tag[], chunkSize = 50, onProgress?: (index: number, total: number, currentTag: Tag) => void): Promise<KTagLocationResult[]> => {
  const total = tags.length;
  const results: KTagLocationResult[] = [];
  let processed = 0;

  const ktagTags = tags.filter(t => t.type !== 'XADTAG' && t.accessoryId && t.hashedAdvKey && t.privateKey);
  const xadtagTags = tags.filter(t => t.type === 'XADTAG');

  // ---- XADTAG: consulta centralizada no Traccar ----
  for (const tag of xadtagTags) {
    if (onProgress) onProgress(processed + 1, total, tag);
    try {
      const result = await trackingApi.checkXadTag(tag.id);
      if (result.position) results.push({
        lat: result.position.latitude,
        lon: result.position.longitude,
        conf: result.position.valid ? 100 : 0,
        status: result.status === 'online' ? 1 : 0,
        battery: { level: 0, label: result.status, color: result.status === 'online' ? '#10b981' : '#71717a' },
        timestamp: Date.parse(result.position.fixTime || result.position.serverTime || '') || Date.now(),
        isodatetime: result.position.fixTime || result.position.serverTime || new Date().toISOString(),
        tagId: tag.id,
      });
    } catch (e: any) {
      console.error(`Erro ao rastrear XADTAG ${tag.traqcareId}:`, e.message);
    }
    processed++;
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // ---- K-TAG: LOTE (feibao doc 3.3) ----
  const settings = await storage.getSettings();
  const proxyUrl = settings.customProxyUrl || '/api/proxy';

  for (let i = 0; i < ktagTags.length; i += chunkSize) {
    const chunk = ktagTags.slice(i, i + chunkSize);
    if (onProgress) onProgress(Math.min(processed + chunk.length, total), total, chunk[0]);

    // hashedAdvKey (decifrado no storage.getTags) → tag, para parear os resultados.
    const byKey = new Map<string, Tag>();
    for (const t of chunk) byKey.set(t.hashedAdvKey as string, t);

    const payload = {
      hashed_keys: chunk.map(t => t.hashedAdvKey),
      priv_keys: chunk.map(t => t.privateKey),
    };
    const proxyBody = JSON.stringify({ injectAuth: 'ktag', method: 'POST', body: payload });

    let attempts = 0;
    const maxAttempts = 5;
    while (attempts <= maxAttempts) {
      try {
        let response = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: proxyBody,
        });
        // Fallback para o proxy padrão se um proxy customizado falhar (5xx).
        if (!response.ok && settings.customProxyUrl && response.status >= 500) {
          response = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: proxyBody,
          });
        }
        if (response.status === 429) {
          if (attempts < maxAttempts) { attempts++; await new Promise(r => setTimeout(r, attempts * 3000)); continue; }
          throw new Error('429: rate limit no lote K-Tag.');
        }
        if (!response.ok) throw new Error(`Erro ${response.status} no lote K-Tag.`);

        const data = JSON.parse(await response.text());
        if (data && Array.isArray(data.results)) {
          for (const p of data.results) {
            const tag = p && p.key ? byKey.get(p.key) : undefined;
            if (!tag) continue; // sem posição para esta chave, ou chave desconhecida
            results.push({
              lat: p.lat,
              lon: p.lon,
              conf: p.conf,
              status: p.status,
              battery: ktagBatteryStatus(p.status),
              timestamp: p.timestamp,
              isodatetime: p.isodatetime,
              tagId: tag.id,
            });
          }
        }
        break; // sucesso
      } catch (e: any) {
        if (String(e.message).includes('429') && attempts < maxAttempts) {
          attempts++;
          await new Promise(r => setTimeout(r, attempts * 3000));
          continue;
        }
        console.error(`Erro no lote K-Tag (${chunk.length} tags):`, e.message);
        break;
      }
    }

    processed += chunk.length;
    if (i + chunkSize < ktagTags.length) await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
};

export const fetchTagLocation = async (tag: Tag): Promise<KTagLocationResult[]> => {
  // Dispatcher Baseado no Tipo de Dispositivo
  if (tag.type === 'XADTAG') {
      return xadtagService.fetchLocation(tag);
  }

  // Lógica Legada K-TAG.
  // Credenciais centralizadas na plataforma: enviamos apenas injectAuth:'ktag' e o
  // relay (server.ts em dev / proxyApi em prod) resolve a URL e injeta o Basic Auth.
  // O navegador nunca recebe usuário/senha da conta K-TAG.
  const settings = await storage.getSettings();
  const payload: any = {
    accessoryId: tag.accessoryId,
    hashed_keys: [tag.hashedAdvKey],
    priv_keys: [tag.privateKey]
  };

  const proxyBody = JSON.stringify({ injectAuth: 'ktag', method: 'POST', body: payload });

  let response: Response | null = null;
  let lastError: any = null;

  try {
      const proxyUrl = settings.customProxyUrl || '/api/proxy';
      response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: proxyBody
      });
  } catch (e: any) {
      console.warn(`Proxy ${settings.customProxyUrl || '/api/proxy'} failed:`, e.message);
      lastError = e;

      if (settings.customProxyUrl) {
          console.log("Falling back to /api/proxy...");
          try {
             response = await fetch('/api/proxy', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: proxyBody
             });
          } catch (fallbackErr: any) {
             console.warn("Fallback /api/proxy failed:", fallbackErr.message);
             lastError = fallbackErr;
          }
      }
  }

  if (!response) {
      throw new Error(lastError?.message || "Falha ao conectar via proxy de rastreio.");
  }

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
