-- ============================================================================
--  migration_v4 — private "documents" bucket for the original zupu scans
-- ----------------------------------------------------------------------------
--  The handwritten 族譜 scans are FAMILY-ONLY. Unlike the public "photos"
--  bucket, this bucket is PRIVATE (public = false): there is no public URL, and
--  files are reachable only through short-lived signed URLs that the app mints
--  for signed-in users. Run this once in the Supabase SQL editor.
--
--  After running, upload the four PDFs into the bucket (Storage → documents)
--  with these exact object keys (matching data/sources.js):
--    kong-family-book-pt1.pdf
--    kong-family-book-pt2.pdf
--    kong-family-book-2nd-ed.pdf
--    kong-family-book-story.pdf
-- ============================================================================

insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do nothing;

-- any signed-in (authenticated) user may read → lets the client mint signed URLs.
-- anonymous visitors get nothing (no public URL, no select grant).
create policy "documents_read" on storage.objects for select to authenticated
  using (bucket_id = 'documents');

-- only admins may add or remove scans through the app (dashboard uploads use the
-- service role and bypass RLS, so this only guards client-side writes).
create policy "documents_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.is_admin());
create policy "documents_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.is_admin());
