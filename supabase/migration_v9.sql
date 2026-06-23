-- ============================================================================
--  migration_v9 — contribution audit columns
-- ----------------------------------------------------------------------------
--  Adds two columns to `contributions` so every decision is fully logged:
--    reviewed_at       — timestamp of the approve/reject decision
--    rejection_reason  — optional reviewer note sent to the contributor
--  Idempotent; safe to run multiple times.
-- ============================================================================

alter table public.contributions
  add column if not exists reviewed_at    timestamptz,
  add column if not exists rejection_reason text;
