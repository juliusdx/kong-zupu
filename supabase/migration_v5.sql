-- ============================================================================
--  migration_v5 — live transcription store for the page-by-page proofreader
-- ----------------------------------------------------------------------------
--  Family members read a scanned page beside its transcription and suggest
--  corrections. Suggestions are ordinary rows in `contributions` (action =
--  "fix_transcription") and go through the same Review queue. When an admin
--  approves one, decide() upserts the corrected text here, and the proofreader
--  shows it on top of the seed text in data/transcription.js.
--
--  Transcription text is not sensitive (only the SCANS are family-only), so
--  reads are public; only admins write (approvals).  Run once in Supabase SQL.
-- ============================================================================

create table if not exists public.transcriptions (
  doc_id     text not null,
  page       int  not null,
  text       text not null default '',
  updated_by uuid references auth.users(id),
  updated_at timestamptz default now(),
  primary key (doc_id, page)
);

alter table public.transcriptions enable row level security;

create policy transcriptions_read  on public.transcriptions
  for select using (true);
create policy transcriptions_write on public.transcriptions
  for all using (public.is_admin()) with check (public.is_admin());
