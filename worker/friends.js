// One row per unordered pair. The sender stays recorded until the recipient accepts.
const json = (data, status = 200) => Response.json(data, {
  status, headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
});

export async function friendFeed(db, userId) {
  const { results } = await db.prepare(`
    SELECT i.owner_id, i.saves_count, i.data, users.name AS owner
    FROM recipes_index i JOIN users ON users.id = i.owner_id
    WHERE i.visibility = 'public' AND i.owner_id IN (
      SELECT user_high FROM friendships WHERE user_low = ? AND status = 'accepted'
      UNION
      SELECT user_low FROM friendships WHERE user_high = ? AND status = 'accepted'
    ) ORDER BY i.saves_count DESC, i.title LIMIT 200
  `).bind(userId, userId).all();
  return results;
}

export async function handleFriends(req, db, user, path) {
  if (!user) return json({ error: 'Inte inloggad.' }, 401);
  if (path === '/friends' && req.method === 'GET') {
    const { results } = await db.prepare(`
      SELECT f.id, f.requested_by, f.status, u.id AS userId, u.name
      FROM friendships f JOIN users u
        ON u.id = CASE WHEN f.user_low = ? THEN f.user_high ELSE f.user_low END
      WHERE f.user_low = ? OR f.user_high = ?
      ORDER BY u.name
    `).bind(user.id, user.id, user.id).all();
    const result = { friends: [], incoming: [], outgoing: [] };
    for (const row of results) {
      const key = row.status === 'accepted' ? 'friends' : row.requested_by === user.id ? 'outgoing' : 'incoming';
      result[key].push({ id: row.id, userId: row.userId, name: row.name });
    }
    return json(result);
  }

  if (path === '/friend-requests' && req.method === 'POST') {
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === 'string' ? body.name.trim().toLowerCase() : '';
    if (!/^[a-zåäö0-9_-]{2,20}$/.test(name)) return json({ error: 'Ange personens kontonamn (2–20 tecken).' }, 400);
    const other = await db.prepare('SELECT id, name FROM users WHERE name = ? AND name <> ?').bind(name, 'grammat').first();
    if (!other) return json({ error: 'Inget konto med det namnet. Be personen kontrollera sitt namn under Konto.' }, 404);
    if (other.id === user.id) return json({ error: 'Du kan inte lägga till dig själv som vän.' }, 400);
    const low = Math.min(user.id, other.id), high = Math.max(user.id, other.id);
    // Unique pair plus conditional insert handles duplicate and crossed requests atomically.
    const inserted = await db.prepare(`
      INSERT INTO friendships (user_low, user_high, requested_by)
      SELECT ?, ?, ? WHERE
        (SELECT COUNT(*) FROM friendships WHERE requested_by = ? AND status = 'pending') < 50
      ON CONFLICT(user_low, user_high) DO NOTHING
    `).bind(low, high, user.id, user.id).run();
    if (!inserted.meta.changes) {
      const existing = await db.prepare('SELECT status, requested_by FROM friendships WHERE user_low = ? AND user_high = ?').bind(low, high).first();
      if (!existing) return json({ error: 'Du har redan 50 obesvarade förfrågningar. Återkalla någon först.' }, 429);
      const error = existing.status === 'accepted' ? 'Ni är redan vänner.'
        : existing.requested_by === user.id ? 'Du har redan skickat en förfrågan.'
          : 'Personen har redan skickat en förfrågan till dig. Acceptera den under Vänner.';
      return json({ error }, 409);
    }
    return json({ ok: true, name: other.name }, 201);
  }

  const accept = path.match(/^\/friend-requests\/(\d+)\/accept$/);
  if (accept && req.method === 'POST') {
    const result = await db.prepare(`
      UPDATE friendships SET status = 'accepted'
      WHERE id = ? AND status = 'pending' AND requested_by <> ?
        AND (user_low = ? OR user_high = ?)
    `).bind(Number(accept[1]), user.id, user.id, user.id).run();
    if (!result.meta.changes) return json({ error: 'Förfrågan finns inte längre eller kan inte accepteras av dig.' }, 404);
    return json({ ok: true });
  }

  const cancel = path.match(/^\/friend-requests\/(\d+)$/);
  if (cancel && req.method === 'DELETE') {
    const result = await db.prepare(`
      DELETE FROM friendships WHERE id = ? AND status = 'pending' AND (user_low = ? OR user_high = ?)
    `).bind(Number(cancel[1]), user.id, user.id).run();
    if (!result.meta.changes) return json({ error: 'Förfrågan finns inte längre.' }, 404);
    return json({ ok: true });
  }

  const remove = path.match(/^\/friends\/(\d+)$/);
  if (remove && req.method === 'DELETE') {
    const otherId = Number(remove[1]);
    const result = await db.prepare(`
      DELETE FROM friendships WHERE user_low = ? AND user_high = ? AND status = 'accepted'
    `).bind(Math.min(user.id, otherId), Math.max(user.id, otherId)).run();
    if (!result.meta.changes) return json({ error: 'Vänskapen finns inte längre.' }, 404);
    return json({ ok: true });
  }
  return json({ error: 'Hittades inte.' }, 404);
}
