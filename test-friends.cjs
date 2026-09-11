const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createTestDb } = require('./test-d1.cjs');

(async () => {
  const { default: worker } = await import('./worker/worker.js');
  const { db, sqlite } = createTestDb();
  for (const [id, name] of [[1, 'alice'], [2, 'bob'], [3, 'carol'], [4, 'grammat']]) {
    sqlite.prepare('INSERT INTO users (id,name,pin_hash,token) VALUES (?,?,?,?)').run(id, name, '', 'test-only-session-' + id);
  }
  // Existing groups survive the additive migration, but confer no friendship.
  sqlite.exec("INSERT INTO groups (id,name,created_by) VALUES (1,'old',1); INSERT INTO group_members (group_id,user_id) VALUES (1,1),(1,2)");
  sqlite.exec(fs.readFileSync('worker/migrations/0001_friendships.sql', 'utf8'));
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM group_members').get().n, 2);
  const call = async (user, path, method = 'GET', body, status = 200) => {
    const response = await worker.fetch(new Request('https://test.invalid' + path, {
      method, headers: user ? { Authorization: 'Bearer test-only-session-' + user } : {},
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }), { DB: db });
    const data = await response.json();
    assert.equal(response.status, status, method + ' ' + path + ': ' + JSON.stringify(data));
    return data;
  };
  const recipe = (id, extra = {}) => ({ id, title: id, portions: 2, course: 'huvudratt', ingredients: [{name: 'pasta', amount: 200}], steps: ['Koka.'], ...extra });
  await call(1, '/state', 'PUT', { recipes: [recipe('alice-public')], selections: [] });
  await call(2, '/state', 'PUT', { recipes: [recipe('bob-public'), recipe('bob-secret', { private: true }), recipe('bob-copy', { src: { owner: 1, id: 'alice-public' } })], selections: [] });
  await call(3, '/state', 'PUT', { recipes: [recipe('carol-public')], selections: [] });
  for (const [path, method] of [['/friends','GET'], ['/friends-feed','GET'], ['/friend-requests','POST'], ['/friend-requests/1/accept','POST'], ['/friend-requests/1','DELETE'], ['/friends/2','DELETE']]) {
    await call(null, path, method, undefined, 401);
  }
  assert.deepEqual(await call(1, '/friends-feed'), [], 'group membership alone gives no friend feed');
  await call(1, '/groups', 'POST', { name: 'old' }, 410);
  await call(1, '/join/ABCD1234', 'POST', undefined, 410);
  await call(1, '/friend-requests', 'POST', null, 400);
  await call(1, '/friend-requests', 'POST', { name: 'alice' }, 400);
  await call(1, '/friend-requests', 'POST', { name: 'missing' }, 404);
  await call(1, '/friend-requests', 'POST', { name: 'grammat' }, 404);
  await call(1, '/friend-requests', 'POST', { name: ' BOB ' }, 201);
  const sent = (await call(1, '/friends')).outgoing[0];
  assert.equal(sent.name, 'bob');
  assert.equal((await call(2, '/friends')).incoming[0].id, sent.id);
  assert.deepEqual(await call(3, '/friends'), { friends: [], incoming: [], outgoing: [] });
  await call(1, '/friend-requests', 'POST', { name: 'bob' }, 409);
  await call(2, '/friend-requests', 'POST', { name: 'alice' }, 409);
  assert.deepEqual(await call(1, '/friends-feed'), [], 'pending request is not friendship');
  await call(1, `/friend-requests/${sent.id}/accept`, 'POST', undefined, 404);
  await call(3, `/friend-requests/${sent.id}/accept`, 'POST', undefined, 404);
  await call(3, `/friend-requests/${sent.id}`, 'DELETE', undefined, 404);
  await call(2, `/friend-requests/${sent.id}/accept`, 'POST');
  await call(2, `/friend-requests/${sent.id}/accept`, 'POST', undefined, 404);
  for (const user of [1, 2]) assert.equal((await call(user, '/friends')).friends.length, 1);
  assert.deepEqual((await call(1, '/friends-feed')).map(r => r.id), ['bob-public'], 'only accepted friend originals, no private or copied recipes');
  assert.deepEqual((await call(2, '/friends-feed')).map(r => r.id), ['alice-public'], 'friendship works both ways');
  await call(1, '/save', 'POST', { ownerId: 1, recipeId: 'alice-public' }, 400);
  await call(2, '/name', 'PUT', { name: 'bobby' });
  assert.equal((await call(1, '/friends')).friends[0].name, 'bobby', 'friendship survives rename');
  await call(1, `/friend-requests/${sent.id}`, 'DELETE', undefined, 404);
  await call(3, '/friends/2', 'DELETE', undefined, 404);
  await call(2, '/friends/1', 'DELETE');
  assert.deepEqual(await call(1, '/friends-feed'), []);
  assert.equal((await call(2, '/friends')).friends.length, 0);
  assert.equal((await call(2, '/state')).state.recipes.length, 3, 'removal preserves saved recipes');
  await call(1, '/friend-requests', 'POST', { name: 'bobby' }, 201);
  const second = (await call(2, '/friends')).incoming[0].id;
  assert.ok(second > sent.id, 'new request cannot reuse a stale accept link');
  await call(2, `/friend-requests/${second}`, 'DELETE');
  await call(2, `/friend-requests/${second}/accept`, 'POST', undefined, 404);
  await call(1, '/friend-requests', 'POST', { name: 'bobby' }, 201);
  const third = (await call(1, '/friends')).outgoing[0].id;
  await call(1, `/friend-requests/${third}`, 'DELETE');
  await call(2, `/friend-requests/${third}/accept`, 'POST', undefined, 404);
  await call(1, '/friend-requests', 'POST', { name: 'bobby' }, 201);
  const fourth = (await call(2, '/friends')).incoming[0].id;
  await call(2, `/friend-requests/${fourth}/accept`, 'POST');
  await call(3, '/friend-requests', 'POST', { name: 'bobby' }, 201);
  await call(2, '/account', 'DELETE');
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM friendships').get().n, 0, 'account removal clears accepted and pending relationships');
  assert.throws(() => sqlite.prepare('INSERT INTO friendships (user_low,user_high,requested_by) VALUES (1,1,1)').run());
  assert.throws(() => sqlite.prepare('INSERT INTO friendships (user_low,user_high,requested_by) VALUES (1,3,4)').run());
  for (let id = 10; id <= 60; id++) {
    sqlite.prepare('INSERT INTO users (id,name,pin_hash,token) VALUES (?,?,?,?)').run(id,'limit' + id,'','test-only-session-' + id);
    if (id < 60) sqlite.prepare('INSERT INTO friendships (user_low,user_high,requested_by) VALUES (1,?,1)').run(id);
  }
  await call(1, '/friend-requests', 'POST', {name: 'limit60'}, 429);
  const pending = (await call(1, '/friends')).outgoing[0].id;
  await call(1, '/friend-requests/' + pending, 'DELETE');
  await call(1, '/friend-requests', 'POST', {name: 'limit60'}, 201);
  sqlite.close();
  console.log('PASS: friendship lifecycle, authorization, feed privacy, account cleanup and additive migration');
})().catch(error => { console.error(error); process.exitCode = 1; });
