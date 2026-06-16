-- ============================================================================
--  migration_v8 — WeChat / WhatsApp handle on a person's private contact
-- ----------------------------------------------------------------------------
--  The `contacts` table (person_id, email, phone, address) holds a person's OWN
--  private contact details — a living-family directory. The contribution form now
--  writes to it on approval and pre-fills it when editing a person. Add a column
--  for the messaging handle (WeChat / WhatsApp), which is how diaspora family are
--  usually reached. contacts RLS already restricts reads/writes to admins and the
--  linked member, so these details are never public. Idempotent; run once.
-- ============================================================================

alter table public.contacts add column if not exists wechat text;
