/**
 * K-TAG location — helpers PUROS (sem dependências Firebase), unit-testáveis.
 *
 * A telemetria observada em produção usa a escala 0=alta … 3=muito baixa.
 */

/**
 * Interpreta o campo `status` (nível de bateria) do feibao.
 * 0=Alta … 3=Muito baixa. Fora da faixa → Desconhecido.
 */
function ktagBatteryStatus(status) {
  switch (status) {
    case 0: return { level: 100, label: 'Alto', color: '#10b981' };
    case 1: return { level: 60, label: 'Médio', color: '#eab308' };
    case 2: return { level: 30, label: 'Baixo', color: '#f97316' };
    case 3: return { level: 10, label: 'Muito baixo', color: '#ef4444' };
    default: return { level: 0, label: 'Desconhecido', color: '#71717a' };
  }
}

/**
 * Normaliza um item de `results[]` do feibao para o formato interno.
 * Mantém `key` (== hashedAdvKey) APENAS para o pareamento do lote — o chamador
 * deve removê-la antes de persistir (não vaza chave em texto plano no Firestore).
 * Retorna null se lat/lon ausentes/ inválidos.
 */
function parseKtagResult(p) {
  if (!p || typeof p.lat !== 'number' || typeof p.lon !== 'number') return null;
  return {
    lat: p.lat,
    lon: p.lon,
    conf: p.conf,
    status: p.status,
    battery: ktagBatteryStatus(p.status),
    timestamp: p.timestamp,
    isodatetime: p.isodatetime,
    key: p.key,
  };
}

/**
 * Mapeia `results[]` (doc 3.3, lote) de volta às tags pela `key` (== hashedAdvKey).
 * A doc do fornecedor EXIGE esse pareamento: cada resultado carrega a `key` a que
 * pertence e a ordem NÃO é garantida. Tags sem posição (Apple não retornou) somem.
 *
 * @param {Array} results  response.data.results do feibao
 * @param {Array} tags     [{ id, accessoryId, hashedAdvKey (decifrado), ... }]
 * @returns {Array<{ tag, location }>}  só pares com posição válida e tag correspondente
 */
function mapKtagBatchResults(results, tags) {
  if (!Array.isArray(results) || !Array.isArray(tags)) return [];
  // hashedAdvKey pode (patologicamente) repetir — fila por chave evita mapear o
  // mesmo resultado a duas tags.
  const byKey = new Map();
  for (const t of tags) {
    if (!t || !t.hashedAdvKey) continue;
    if (!byKey.has(t.hashedAdvKey)) byKey.set(t.hashedAdvKey, []);
    byKey.get(t.hashedAdvKey).push(t);
  }
  const out = [];
  for (const p of results) {
    const location = parseKtagResult(p);
    if (!location || !location.key) continue;
    const queue = byKey.get(location.key);
    if (!queue || queue.length === 0) continue;
    const tag = queue.shift();
    out.push({ tag, location });
  }
  return out;
}

module.exports = { ktagBatteryStatus, parseKtagResult, mapKtagBatchResults };
