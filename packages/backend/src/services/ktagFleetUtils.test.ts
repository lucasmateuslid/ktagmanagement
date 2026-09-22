import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeKtagSerial, pairKtagResults } from './ktagFleetUtils.js';

test('pairKtagResults mantém itens distintos quando a chave se repete', () => {
  const first = { id: 'a', hashedAdvKey: 'same' }; const second = { id: 'b', hashedAdvKey: 'same' };
  const pairs = pairKtagResults([first, second], [{ key: 'same', lat: 1 }, { key: 'same', lat: 2 }]);
  assert.deepEqual(pairs.map(pair => [pair.item.id, pair.raw.lat]), [['a', 1], ['b', 2]]);
});

test('pairKtagResults aceita resposta sem key em consulta unitária', () => {
  const item = { id: 'a', hashedAdvKey: 'only' };
  assert.equal(pairKtagResults([item], [{ lat: 1 }])[0]?.item, item);
});

test('normalizeKtagSerial preserva zeros do serial original', () => {
  assert.equal(normalizeKtagSerial(' 00007260500014 '), '00007260500014');
});
