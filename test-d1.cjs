// Real SQLite, with the D1 methods used by this Worker. No network or production data.
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
exports.createTestDb = () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(fs.readFileSync(__dirname + '/worker/schema.sql', 'utf8'));
  const db = {
    prepare(sql) {
      let params = [];
      return {
        bind(...values) { params = values; return this; },
        async first() { return sqlite.prepare(sql).get(...params) || null; },
        async all() { return { results: sqlite.prepare(sql).all(...params) }; },
        async run() {
          const result = sqlite.prepare(sql).run(...params);
          return { results: [], meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
        },
        async execute() { return /^\s*SELECT\b/i.test(sql) ? this.all() : this.run(); },
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.execute());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  return { db, sqlite };
};
