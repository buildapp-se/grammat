-- Additive migration: retain old groups for rollback, never infer consent from membership.
CREATE TABLE IF NOT EXISTS friendships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_low INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_low, user_high),
  CHECK (user_low < user_high),
  CHECK (requested_by = user_low OR requested_by = user_high)
);
CREATE INDEX IF NOT EXISTS idx_friendships_high ON friendships(user_high, status);
CREATE INDEX IF NOT EXISTS idx_friendships_sender ON friendships(requested_by, status);
