import assert from 'node:assert/strict';
import test from 'node:test';
import { duplicateKtagKeys, normalizeKtagSerial, pairKtagResults } from './ktagFleetUtils.js';

const point = (key: string, timestamp: number, lat = -8) => ({ key, timestamp, lat, lon: -35 });

test('não atribui posições por ordem quando dois equipamentos têm a mesma chave', () => {
  const items = [{ id: 'a', hashedAdvKey: 'same' }, { id: 'b', hashedAdvKey: 'same' }];
  assert.deepEqual(pairKtagResults(items, [point('same', 1700000000), point('same', 1700000010)]), []);
  assert.deepEqual([...duplicateKtagKeys(items)], ['same']);
});

test('seleciona a posição mais recente por chave com respostas fora de ordem e inválidas', () => {
  const items = [{ id: 'a', hashedAdvKey: 'A' }, { id: 'b', hashedAdvKey: 'B' }];
  const results = [point('B', 1700000020), point('A', 1700000000), point('A', 1700000030), point('B', 1700000010), point('A', 1700000090, 999), point('unknown', 1700000100)];
  assert.deepEqual(pairKtagResults(items, results).map(({ item, raw }) => [item.id, raw.timestamp]), [['b', 1700000020], ['a', 1700000030]]);
});

test('aceita resposta sem key somente em consulta unitária', () => {
  const item = { id: 'a', hashedAdvKey: 'only' };
  assert.equal(pairKtagResults([item], [{ ...point('', 1700000000) }])[0]?.item, item);
  assert.deepEqual(pairKtagResults([item, { id: 'b', hashedAdvKey: 'B' }], [point('', 1700000000)]), []);
});

test('normalizeKtagSerial preserva zeros do serial original', () => {
  assert.equal(normalizeKtagSerial(' 00007260500014 '), '00007260500014');
});
