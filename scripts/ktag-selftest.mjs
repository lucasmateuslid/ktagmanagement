/**
 * Self-test das funções PURAS de K-TAG (sem rede). Testa o código realmente
 * enviado (functions/ktagLocation.js e functions/ktagCrypto.js).
 *   node scripts/ktag-selftest.mjs
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ktagBatteryStatus, mapKtagBatchResults } = require('../functions/ktagLocation.js');
const ktagCrypto = require('../functions/ktagCrypto.js');

let groups = 0;
const ok = (name) => { groups++; console.log('  ✓', name); };

// 1) Bateria: escala CORRIGIDA conforme a doc (0=muito baixo … 3=alto).
assert.equal(ktagBatteryStatus(0).label, 'Muito baixo');
assert.equal(ktagBatteryStatus(0).level, 10);
assert.equal(ktagBatteryStatus(3).label, 'Alto');
assert.equal(ktagBatteryStatus(3).level, 100);
assert.ok(ktagBatteryStatus(0).level < ktagBatteryStatus(3).level);
assert.equal(ktagBatteryStatus(99).label, 'Desconhecido');
ok('bateria: 0=muito baixo(10) … 3=alto(100)');

// 2) Lote: pareia por `key`, ignora key desconhecida e posição inválida.
const tags = [
  { id: 'a', hashedAdvKey: 'KEYA', accessoryId: 'K1' },
  { id: 'b', hashedAdvKey: 'KEYB', accessoryId: 'K2' },
];
const results = [
  { lat: 1, lon: 2, status: 3, timestamp: 100, key: 'KEYB' }, // tag b
  { lat: 9, lon: 9, status: 0, timestamp: 200, key: 'KEYZ' }, // key desconhecida
  { lat: null, lon: 5, key: 'KEYA' },                          // lat inválida
];
const mapped = mapKtagBatchResults(results, tags);
assert.equal(mapped.length, 1);
assert.equal(mapped[0].tag.id, 'b');
assert.equal(mapped[0].location.lat, 1);
assert.equal(mapped[0].location.battery.label, 'Alto');
ok('lote: pareia por key; descarta desconhecida/inválida (ordem não garantida)');

// 3) Lote: tags sem hashedAdvKey são ignoradas.
const tags2 = [{ id: 'x', hashedAdvKey: 'K' }, { id: 'y' }];
const mapped2 = mapKtagBatchResults([{ lat: 1, lon: 1, status: 1, key: 'K' }], tags2);
assert.equal(mapped2.length, 1);
assert.equal(mapped2[0].tag.id, 'x');
ok('lote: tags sem hashedAdvKey ignoradas');

// 4) Cripto: round-trip + passthrough seguro (texto plano e base64 alheio).
const t = 'tenant-demo';
const secret = 'abc123-private-key-value';
const enc = await ktagCrypto.encrypt(t, secret);
assert.notEqual(enc, secret);
assert.equal(await ktagCrypto.decrypt(t, enc), secret);
assert.equal(await ktagCrypto.decrypt('outro-tenant', enc), enc); // chave errada → passthrough
assert.equal(await ktagCrypto.decrypt(t, 'texto-plano-com-hifen'), 'texto-plano-com-hifen');
const b64Alheio = 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU2Nzg5'; // base64 válido, não é nosso ciphertext
assert.equal(await ktagCrypto.decrypt(t, b64Alheio), b64Alheio); // GCM falha → passthrough
ok('cripto: round-trip + passthrough seguro');

console.log(`\nOK — ${groups} grupos de asserções passaram.`);
