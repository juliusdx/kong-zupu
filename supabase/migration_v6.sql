-- ============================================================================
--  migration_v6 — milk name (乳名) + other-names (字 / 號 / nickname) columns
-- ----------------------------------------------------------------------------
--  The contribution form already collects 乳名 (milkName) and "other names"
--  (字 / 號 / 洗禮名 / 綽號 → aka), and the seed in data/lineage.js carries them,
--  but the live `persons` table had no columns to store them — so an approved
--  "add child" / "edit" correction silently dropped both fields. These two
--  text columns let those edits persist and merge over the seed like every
--  other field. Idempotent; run once in the Supabase SQL editor.
-- ============================================================================

alter table public.persons add column if not exists milk_name text;   -- 乳名
alter table public.persons add column if not exists aka       text;   -- 字 / 號 / 洗禮名 / 綽號
