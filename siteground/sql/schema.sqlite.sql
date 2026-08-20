-- Test-only mirror of schema.mysql.sql, for tests/run.php. SQLite has no ENUM
-- and no ON UPDATE, so those become CHECK constraints and plain columns; every
-- column NAME and every constraint that the privacy rules depend on is identical.
PRAGMA foreign_keys = ON;

CREATE TABLE persons (
  id VARCHAR(64) PRIMARY KEY, gen INT, name TEXT NOT NULL, pinyin TEXT,
  ritual_name TEXT, formal_name TEXT, hao TEXT, milk_name TEXT, aka TEXT,
  gender VARCHAR(8), father_id VARCHAR(64), spouse_of VARCHAR(64),
  birth_year TEXT, death_year TEXT, lifespan TEXT, religion TEXT, relation TEXT, bio TEXT,
  birth_place VARCHAR(64), residence_place VARCHAR(64), burial_place VARCHAR(64),
  lat DOUBLE, lng DOUBLE,
  living INTEGER NOT NULL DEFAULT 0,
  is_minor INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','member','admin')),
  confidence VARCHAR(16), source VARCHAR(32) DEFAULT 'contribution',
  archived INTEGER NOT NULL DEFAULT 0, archived_at DATETIME, archived_by CHAR(36), archived_reason TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE person_details (
  person_id VARCHAR(64) PRIMARY KEY, birth_year TEXT, death_year TEXT, lifespan TEXT,
  religion TEXT, occupation TEXT, bio TEXT, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
);
CREATE TABLE contacts (
  person_id VARCHAR(64) PRIMARY KEY, email TEXT, phone TEXT, wechat TEXT, address TEXT,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
);
CREATE TABLE places (
  id VARCHAR(64) PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('origin','residence','grave','church_grave','hall','diaspora')),
  name TEXT NOT NULL, name_en TEXT, lat DOUBLE, lng DOUBLE,
  approximate INTEGER NOT NULL DEFAULT 1, note TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','member','admin')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE media (
  id CHAR(36) PRIMARY KEY, person_id VARCHAR(64), place_id VARCHAR(64),
  path VARCHAR(512) NOT NULL, caption TEXT,
  visibility TEXT NOT NULL DEFAULT 'member' CHECK (visibility IN ('public','member','admin')),
  approved INTEGER NOT NULL DEFAULT 0, cover INTEGER NOT NULL DEFAULT 0,
  uploaded_by CHAR(36), created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE contributions (
  id CHAR(36) PRIMARY KEY, payload TEXT NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'pending',
  submitted_by CHAR(36), reviewed_by CHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at DATETIME, rejection_reason TEXT
);
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, full_name TEXT,
  person_id VARCHAR(64), is_admin INTEGER NOT NULL DEFAULT 0, approved INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, last_seen_at DATETIME
);
CREATE TABLE login_tokens (
  token_hash CHAR(64) PRIMARY KEY, email VARCHAR(255) NOT NULL, expires_at DATETIME NOT NULL,
  used_at DATETIME, created_ip VARCHAR(45), created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id CHAR(36), verdict VARCHAR(24) NOT NULL, resource VARCHAR(128) NOT NULL, detail TEXT
);
CREATE TABLE counters (key VARCHAR(64) PRIMARY KEY, value BIGINT NOT NULL DEFAULT 0);
CREATE TABLE transcriptions (
  doc_id VARCHAR(64) NOT NULL, page INT NOT NULL, text TEXT NOT NULL,
  updated_by CHAR(36), updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (doc_id, page)
);
