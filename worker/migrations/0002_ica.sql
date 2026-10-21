-- Additive migration: workerns ICA-inloggning, en rad (id 1) med klient och token som JSON. Skrivs av worker/ica.js.
CREATE TABLE IF NOT EXISTS ica (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  state TEXT NOT NULL
);
