import assert from 'node:assert/strict';
import test from 'node:test';
import { KtagClient, KtagHttpError } from './ktagClient.js';

const withConfig = async (run: () => Promise<void>) => {
  const previous = { url: process.env.KTAG_API_URL, user: process.env.KTAG_API_USER, pass: process.env.KTAG_API_PASS };
  process.env.KTAG_API_URL = 'https://api.gps308.com/feibao'; process.env.KTAG_API_USER = 'user'; process.env.KTAG_API_PASS = 'pass';
  try { await run(); } finally {
    if (previous.url === undefined) delete process.env.KTAG_API_URL; else process.env.KTAG_API_URL = previous.url;
    if (previous.user === undefined) delete process.env.KTAG_API_USER; else process.env.KTAG_API_USER = previous.user;
    if (previous.pass === undefined) delete process.env.KTAG_API_PASS; else process.env.KTAG_API_PASS = previous.pass;
  }
};

test('consulta o Feibao com as chaves e preserva todos os pontos conhecidos', () => withConfig(async () => {
  let request: RequestInit | undefined;
  const client = new KtagClient(async (_url, init) => {
    request = init;
    return new Response(JSON.stringify({ results: [
      { key: 'hash-1', timestamp: 1_700_000_000, lat: -8, lon: -35, conf: 90, status: 3 },
      { key: 'hash-1', timestamp: 1_700_000_100, latitude: -8.1, lng: -35.1, conf: 80, status: 2 },
      { key: 'unknown', timestamp: 1_700_000_200, lat: -8.2, lon: -35.2 },
    ] }), { status: 200 });
  });
  const points = await client.getHistory([{ hashedKey: 'hash-1', privateKey: 'private-1' }]);
  assert.equal(points.length, 2); assert.equal(points[1].lon, -35.1);
  assert.deepEqual(JSON.parse(String(request?.body)), { hashed_keys: ['hash-1'], priv_keys: ['private-1'] });
  assert.equal((request?.headers as Record<string, string>).Authorization, `Basic ${Buffer.from('user:pass').toString('base64')}`);
}));

test('expõe falhas HTTP do fornecedor', () => withConfig(async () => {
  const client = new KtagClient(async () => new Response('{}', { status: 401 }));
  await assert.rejects(() => client.getHistory([{ hashedKey: 'hash-1', privateKey: 'private-1' }]), (error: unknown) => error instanceof KtagHttpError && error.status === 401);
}));
