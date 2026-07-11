/**
 * Smoke test de CONECTIVIDADE do K-TAG contra api.gps308.com.
 * NÃO commitar segredos — as credenciais vêm do ambiente.
 *
 * Uso (com as credenciais reais da plataforma, fora do CI):
 *   KTAG_API_USER=... KTAG_API_PASS=... node scripts/ktag-smoke.mjs
 * Opcional: KTAG_API_URL, KTAG_KEYS_API_URL para sobrescrever os defaults.
 *
 * Passo 1 — keysByLogin (doc 3.1): valida credenciais e mostra se as chaves
 *           rotacionaram (causa comum de "parou de conectar").
 * Passo 2 — feibao lote (doc 3.3): envia 1 chave da lista e imprime `results`.
 *
 * Segurança: NUNCA imprime privateKey/hashedAdvKey completos (mascara).
 */
const KEYS_URL = process.env.KTAG_KEYS_API_URL || 'https://api.gps308.com/tag/system/tag/device/keysByLogin';
const FEIBAO_URL = process.env.KTAG_API_URL || 'https://api.gps308.com/feibao/';
const user = process.env.KTAG_API_USER;
const pass = process.env.KTAG_API_PASS;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const mask = (s) => (typeof s === 'string' && s.length > 8) ? `${s.slice(0, 4)}…${s.slice(-2)}` : '***';

if (!user || !pass) {
  console.error('Defina KTAG_API_USER e KTAG_API_PASS no ambiente antes de rodar.');
  process.exit(2);
}

async function main() {
  console.log('== 1) keysByLogin ==', KEYS_URL);
  const kr = await fetch(KEYS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ username: user, password: pass }),
  });
  console.log('HTTP', kr.status);
  const kd = await kr.json().catch(() => ({}));
  console.log('code:', kd.code, '| msg:', kd.msg);
  const list = (kd.data && kd.data.list) || [];
  console.log('dispositivos retornados:', list.length);
  if (list[0]) {
    console.log('exemplo:', { sn: list[0].sn, privateKey: mask(list[0].privateKey), hashedAdvKey: mask(list[0].hashedAdvKey) });
  }
  if (list.length === 0) { console.log('Sem dispositivos — encerrando.'); return; }

  console.log('\n== 2) feibao lote (1 chave) ==', FEIBAO_URL);
  const auth = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
  const fr = await fetch(FEIBAO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': auth, 'User-Agent': UA },
    body: JSON.stringify({ hashed_keys: [list[0].hashedAdvKey], priv_keys: [list[0].privateKey] }),
  });
  console.log('HTTP', fr.status);
  const fd = await fr.json().catch(() => ({}));
  const results = fd.results || [];
  console.log('results:', results.length);
  if (results[0]) {
    const r = results[0];
    console.log('posição:', { lat: r.lat, lon: r.lon, status: r.status, isodatetime: r.isodatetime, key: mask(r.key) });
  }
  if (fr.status === 401 || fr.status === 500) {
    console.log('\n⚠️  feibao rejeitou o Basic auth. Pode exigir a credencial dedicada do');
    console.log('    gateway (a doc mostra o exemplo TagLocation:...). Ajuste as credenciais.');
  }
}

main().catch((e) => { console.error('Erro:', e.message); process.exit(1); });
