-- ============================================================================
--  migration_v10 — private bucket for member-tier (living members') photos
-- ----------------------------------------------------------------------------
--  Before this, ALL photos lived in the public "photos" bucket. Member-tier
--  rows were hidden from anonymous visitors by the media RLS policy, but the
--  underlying file was still reachable by anyone who knew its URL (the bucket
--  is public). This adds a PRIVATE bucket so living members' photos are served
--  only via short-lived signed URLs to signed-in family — never by a public URL.
--
--  • public "photos" bucket  → unchanged: places + public/deceased photos.
--  • new private "photos-private" bucket → member-tier person photos.
--    The app stores the object PATH (media.private_path) and mints a signed URL
--    at load time; anonymous visitors get no media row and no read access here.
--
--  Idempotent; run once in the Supabase SQL editor.
-- ============================================================================

-- 1) the private bucket
insert into storage.buckets (id, name, public)
  values ('photos-private', 'photos-private', false)
  on conflict (id) do nothing;

-- 2) storage policies — only signed-in family can read (via signed URLs) or write;
--    anonymous visitors have NO policy here, so they cannot read at all.
drop policy if exists "photos_priv_read"   on storage.objects;
drop policy if exists "photos_priv_write"  on storage.objects;
drop policy if exists "photos_priv_delete" on storage.objects;

create policy "photos_priv_read" on storage.objects for select to authenticated
  using (bucket_id = 'photos-private');
create policy "photos_priv_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos-private');
create policy "photos_priv_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos-private' and owner = auth.uid());

-- 3) remember the private-bucket object path (null = file lives in the public bucket)
alter table media add column if not exists private_path text;
-- public-bucket rows keep their url; private rows store only the path, so url is optional
alter table media alter column url drop not null;
