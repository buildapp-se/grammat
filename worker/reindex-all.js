// Engångs-reindex av ALLA användares blobbar till recipes_index (behövs vid fas 2-deployen:
// befintliga blobbar indexeras annars först vid användarens nästa PUT /state). Rerunnbar.
//   npx wrangler d1 execute recept --remote --command "SELECT id, state FROM users WHERE state != ''" --json > dump.json
//   node reindex-all.js dump.json > reindex.sql
//   npx wrangler d1 execute recept --remote --file reindex.sql     (radera dump.json + reindex.sql efteråt)
// ESM (worker/package.json har "type": "module") och samma urval och sanering som PUT /state
// via indexRows: förut kraschade skriptet på require, och det indexerade egna kategorier (tags)
// och sparade kopior (src) som workern aldrig lägger i det publika flödet.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { indexRows } from './worker.js';

export function reindexSql(rows) {
  const q = s => "'" + String(s).replace(/'/g, "''") + "'";
  let sql = '';
  for (const { id, state } of rows) {
    let s;
    try { s = JSON.parse(state); } catch (e) { continue; }
    if (!s || !Array.isArray(s.recipes)) continue;
    sql += `DELETE FROM recipes_index WHERE owner_id = ${Number(id)};\n`;
    for (const r of indexRows(s.recipes)) {
      sql += `INSERT INTO recipes_index (owner_id, id, title, course, visibility, saves_count, data)
  VALUES (${Number(id)}, ${q(r.id)}, ${q(r.title)}, ${q(r.course)}, 'public',
    (SELECT COUNT(*) FROM saves WHERE owner_id = ${Number(id)} AND recipe_id = ${q(r.id)}), ${q(r.data)});\n`;
    }
  }
  return sql;
}

if (process.argv[2]) process.stdout.write(reindexSql(JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'))[0].results));
