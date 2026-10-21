// POST /ica: bara inloggade patrik och julia, giltig lista, rader i ICA-appens form. ICA låtsas via fetch, inget nätverk.
const assert = require('node:assert/strict');
const { createTestDb } = require('./test-d1.cjs');

(async () => {
  const { default: worker } = await import('./worker/worker.js');
  const { parseIngredient } = await import('./worker/ica.js');
  const { db, sqlite } = createTestDb();
  for (const [id, name] of [[1, 'patrik'], [2, 'alice']]) {
    sqlite.prepare('INSERT INTO users (id,name,pin_hash,token) VALUES (?,?,?,?)').run(id, name, '', 'test-only-session-' + id);
  }
  const sent = [];
  globalThis.fetch = async (url, init) => { sent.push([String(url), init]); return Response.json({}); };
  const call = async (user, body, env = {}) => {
    const res = await worker.fetch(new Request('https://test.invalid/ica', {
      method: 'POST', headers: user ? { Authorization: 'Bearer test-only-session-' + user } : {}, body: JSON.stringify(body),
    }), { DB: db, ICA_LIST: 'LIST', ...env });
    return [res.status, await res.json()];
  };
  const list = { items: [{ name: 'gul lök (eller schalottenlök)', quantity: 2, unit: 'st' }, { name: 'gul lök', quantity: 0.5, unit: 'st' }, { name: '2 l mjölk' }, { name: 'svartpeppar' }] };

  assert.equal((await call(null, list))[0], 401, 'utan inloggning');
  assert.equal((await call(2, list))[0], 403, 'annat konto');
  assert.equal((await call(1, list, { ICA_LIST: '' }))[0], 503, 'ingen lista inställd');
  for (const bad of [{}, { items: [] }, { items: [{ name: '' }] }, { items: [{ name: 'mjölk', quantity: -1 }] }, { items: [{ name: 'mjölk', unit: 5 }] }]) {
    assert.equal((await call(1, bad))[0], 400, JSON.stringify(bad));
  }
  const [status, body] = await call(1, list);
  assert.deepEqual([status, body.error], [400, 'ICA är inte inkopplad: workern saknar ICA_USERNAME och ICA_PASSWORD.'], 'utan secrets och utan sparad token');
  assert.ok(sent.every(([url]) => !url.includes('/sync')), 'inget av de felaktiga anropen nådde listan');

  sqlite.prepare('INSERT INTO ica (id, state) VALUES (1, ?)').run(JSON.stringify({
    client: { client_id: 'c', client_secret: 's', scope: 'x' }, token: { access_token: 'AT', refresh_token: 'RT', expiry: Date.now() / 1000 + 3600 },
  }));
  sent.length = 0;
  assert.deepEqual(await call(1, list), [200, { added: 3 }]);
  const [url, init] = sent[0];
  assert.match(url, /\/shoppinglists\/LIST\/sync$/);
  assert.equal(init.headers.Authorization, 'Bearer AT');
  assert.deepEqual(JSON.parse(init.body).createdRows.map(r => [r.productName, r.quantity, r.unit, r.sourceId, r.articleGroupId]), [
    ['gul lök', 2.5, 'st', 55192, 4],
    ['mjölk', 2, 'l', 11103, 10],
    ['svartpeppar', undefined, undefined, 11654, 9],
  ]);

  assert.deepEqual(parseIngredient('1 1/2 dl grädde'), { name: 'grädde', quantity: 1.5, unit: 'dl' });
  assert.deepEqual(parseIngredient('2-3 vitlöksklyftor'), { name: 'vitlöksklyftor', quantity: 3, unit: 'st' });
  console.log('test-ica OK');
})().catch(e => { console.error(e); process.exit(1); });
