-- Scepter of Sorlax, Datenbankschema. MySQL 8, utf8mb4.
-- Einspielen: mysql -u <user> -p <datenbank> < schema.sql
--
-- Es gibt keine Migrationsdateien. Aendert sich das Schema, steht die
-- Aenderung hier und in backend/README.md.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME NOT NULL,
  last_login_at DATETIME NULL,
  status        ENUM('active','locked') NOT NULL DEFAULT 'active',
  PRIMARY KEY (id),
  UNIQUE KEY uniq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- `token_hash` ist SHA-256 des Tokens, nie der Token selbst. Wer die
-- Datenbank kopiert, kann damit keine Sitzung uebernehmen.
CREATE TABLE IF NOT EXISTS sessions (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      BIGINT UNSIGNED NOT NULL,
  token_hash   CHAR(64) NOT NULL,
  created_at   DATETIME NOT NULL,
  expires_at   DATETIME NOT NULL,
  last_seen_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_sessions_token (token_hash),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- `payload` ist der mit gzip komprimierte JSON-Text. `checksum` ist SHA-256
-- ueber den unkomprimierten Text, damit sie zur `SaveMeta` des Clients passt.
CREATE TABLE IF NOT EXISTS saves (
  user_id      BIGINT UNSIGNED NOT NULL,
  difficulty   ENUM('normal','hard','nightmare') NOT NULL,
  slot         TINYINT UNSIGNED NOT NULL,
  payload      LONGBLOB NOT NULL,
  checksum     CHAR(64) NOT NULL,
  turn_count   INT UNSIGNED NOT NULL,
  level        SMALLINT UNSIGNED NOT NULL,
  map_id       VARCHAR(64) NOT NULL,
  map_name     VARCHAR(128) NOT NULL,
  play_time_ms BIGINT UNSIGNED NOT NULL,
  updated_at   DATETIME NOT NULL,
  PRIMARY KEY (user_id, difficulty, slot),
  CONSTRAINT fk_saves_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ratenbegrenzung. `bucket` ist zum Beispiel "login:203.0.113.5" oder
-- "login:mail@example.org". Alte Zeilen raeumt backend/tools/prune.php weg.
CREATE TABLE IF NOT EXISTS auth_attempts (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bucket     VARCHAR(190) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_attempts_bucket (bucket, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
