-- Nur fuer backend/tools/selftest.php. Die verbindliche Fassung ist
-- backend/schema.sql fuer MySQL 8; diese hier bildet dieselben Tabellen in
-- SQLite nach, damit sich die Endpunkte ohne MySQL durchspielen lassen.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  last_login_at TEXT NULL,
  status        TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE saves (
  user_id      INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  difficulty   TEXT NOT NULL,
  slot         INTEGER NOT NULL,
  payload      BLOB NOT NULL,
  checksum     TEXT NOT NULL,
  turn_count   INTEGER NOT NULL,
  level        INTEGER NOT NULL,
  map_id       TEXT NOT NULL,
  map_name     TEXT NOT NULL,
  play_time_ms INTEGER NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, difficulty, slot)
);

CREATE TABLE auth_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  bucket     TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_attempts_bucket ON auth_attempts (bucket, created_at);
