-- ============================================================================
--  Kong Zupu — MySQL schema for SiteGround
--
--  Translated from the Supabase/Postgres schema. The privacy model is the same
--  one, moved from RLS policies into WHERE clauses (see lib/visibility.php):
--    visibility = 'public'  → anyone
--    visibility = 'member'  → signed-in only
--    is_minor = 1           → admins only, never public, never listed
--  Keeping the column names identical to Postgres means the front-end's field
--  mapping (camel() in js/app.js) does not change.
--
--  utf8mb4 throughout: the names are Chinese, and utf8mb3 cannot hold them all.
-- ============================================================================

SET NAMES utf8mb4;

-- ---- people ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS persons (
  id              VARCHAR(64)  NOT NULL PRIMARY KEY,
  gen             INT          NULL,
  name            TEXT         NOT NULL,
  pinyin          TEXT         NULL,
  ritual_name     TEXT         NULL,
  formal_name     TEXT         NULL,
  hao             TEXT         NULL,
  milk_name       TEXT         NULL,
  aka             TEXT         NULL,
  gender          VARCHAR(8)   NULL,
  father_id       VARCHAR(64)  NULL,
  spouse_of       VARCHAR(64)  NULL,
  birth_year      TEXT         NULL,
  death_year      TEXT         NULL,
  lifespan        TEXT         NULL,
  religion        TEXT         NULL,
  relation        TEXT         NULL,
  bio             TEXT         NULL,
  birth_place     VARCHAR(64)  NULL,
  residence_place VARCHAR(64)  NULL,
  burial_place    VARCHAR(64)  NULL,
  lat             DOUBLE       NULL,
  lng             DOUBLE       NULL,
  living          TINYINT(1)   NOT NULL DEFAULT 0,
  is_minor        TINYINT(1)   NOT NULL DEFAULT 0,
  visibility      ENUM('public','member','admin') NOT NULL DEFAULT 'public',
  confidence      VARCHAR(16)  NULL,
  source          VARCHAR(32)  NULL DEFAULT 'contribution',
  archived        TINYINT(1)   NOT NULL DEFAULT 0,
  archived_at     DATETIME     NULL,
  archived_by     CHAR(36)     NULL,
  archived_reason TEXT         NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_persons_father (father_id),
  KEY idx_persons_spouse (spouse_of),
  -- the three columns every visibility WHERE clause touches
  KEY idx_persons_gate (archived, visibility, is_minor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Gated detail: birth year, bio and the like for LIVING members. Separate table
-- so the basic skeleton can be served to any signed-in member while the detail
-- needs approval — exactly as person_details did on Supabase.
CREATE TABLE IF NOT EXISTS person_details (
  person_id   VARCHAR(64) NOT NULL PRIMARY KEY,
  birth_year  TEXT NULL,
  death_year  TEXT NULL,
  lifespan    TEXT NULL,
  religion    TEXT NULL,
  occupation  TEXT NULL,
  bio         TEXT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_details_person FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Private contact directory: readable only by that person or an admin.
CREATE TABLE IF NOT EXISTS contacts (
  person_id  VARCHAR(64) NOT NULL PRIMARY KEY,
  email      TEXT NULL,
  phone      TEXT NULL,
  wechat     TEXT NULL,
  address    TEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_contacts_person FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- places ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS places (
  id          VARCHAR(64) NOT NULL PRIMARY KEY,
  type        ENUM('origin','residence','grave','church_grave','hall','diaspora') NOT NULL,
  name        TEXT NOT NULL,
  name_en     TEXT NULL,
  -- NULL lat/lng is legitimate: many graves survive only as a 土名 and nobody
  -- alive knows where that is. The map skips them; they still belong to a person.
  lat         DOUBLE NULL,
  lng         DOUBLE NULL,
  approximate TINYINT(1) NOT NULL DEFAULT 1,
  note        TEXT NULL,
  visibility  ENUM('public','member','admin') NOT NULL DEFAULT 'public',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- photos ---------------------------------------------------------------
-- `path` replaces Supabase's url/private_path pair. There is no URL column at
-- all any more: every file is served by photo.php, which checks first. That is
-- the whole point of moving — the gate and the file become one code path.
CREATE TABLE IF NOT EXISTS media (
  id           CHAR(36)    NOT NULL PRIMARY KEY,
  person_id    VARCHAR(64) NULL,
  place_id     VARCHAR(64) NULL,
  path         VARCHAR(512) NOT NULL,
  caption      TEXT NULL,
  visibility   ENUM('public','member','admin') NOT NULL DEFAULT 'member',
  approved     TINYINT(1) NOT NULL DEFAULT 0,
  cover        TINYINT(1) NOT NULL DEFAULT 0,
  uploaded_by  CHAR(36) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_media_person (person_id),
  KEY idx_media_place (place_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- contributions --------------------------------------------------------
CREATE TABLE IF NOT EXISTS contributions (
  id               CHAR(36) NOT NULL PRIMARY KEY,
  payload          JSON NOT NULL,
  status           VARCHAR(16) NOT NULL DEFAULT 'pending',
  submitted_by     CHAR(36) NULL,
  reviewed_by      CHAR(36) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at      DATETIME NULL,
  rejection_reason TEXT NULL,
  KEY idx_contrib_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- accounts -------------------------------------------------------------
-- Replaces Supabase Auth. Email is the identity; there is no password column
-- because there are no passwords — see auth/request.php.
CREATE TABLE IF NOT EXISTS users (
  id           CHAR(36) NOT NULL PRIMARY KEY,
  email        VARCHAR(255) NOT NULL,
  full_name    TEXT NULL,
  person_id    VARCHAR(64) NULL,
  is_admin     TINYINT(1) NOT NULL DEFAULT 0,
  approved     TINYINT(1) NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NULL,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Magic-link tokens. Only the SHA-256 HASH is stored: a leaked database backup
-- must not hand someone a working sign-in link.
CREATE TABLE IF NOT EXISTS login_tokens (
  token_hash  CHAR(64) NOT NULL PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  expires_at  DATETIME NOT NULL,
  used_at     DATETIME NULL,
  created_ip  VARCHAR(45) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tokens_email (email, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- What was refused, and what WOULD have been refused while the enforcement
-- switch is still off. This is how deploy day gets debugged without locking
-- relatives out — see lib/visibility.php.
CREATE TABLE IF NOT EXISTS access_log (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id    CHAR(36) NULL,
  verdict    VARCHAR(24) NOT NULL,
  resource   VARCHAR(128) NOT NULL,
  detail     TEXT NULL,
  KEY idx_access_at (at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS counters (
  `key`  VARCHAR(64) NOT NULL PRIMARY KEY,
  value  BIGINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transcriptions (
  doc_id     VARCHAR(64) NOT NULL,
  page       INT NOT NULL,
  text       LONGTEXT NOT NULL,
  updated_by CHAR(36) NULL,
  updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (doc_id, page)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
