-- ============================================================================
--  migration_v14 — admin Members panel (approve / revoke family sign-ups)
-- ----------------------------------------------------------------------------
--  profiles.approved has existed since migration_approved_members, but there was
--  never any UI for it — approving a member meant hand-running an UPDATE in the SQL
--  editor. New sign-ups land approved = false (handle_new_user doesn't set it, so the
--  column default applies), so without a panel they silently sit unapproved and see
--  living relatives as name-only skeletons. This adds the two server pieces the
--  Members tab needs:
--
--    1. public.members_admin  — a read-only view listing every profile WITH its
--       auth.users email (the client cannot read auth.users directly).
--    2. public.set_member_approved(uuid, boolean) — the only write path.
--
--  Both re-check is_admin() server-side. The client hides the tab for non-admins,
--  but that is cosmetic — these are the real gate.
--
--  Idempotent; run once in the Supabase SQL editor.
-- ============================================================================

-- 1) Admin-only member list ---------------------------------------------------
--  Definer rights are REQUIRED here: the view joins auth.users, which anon and
--  authenticated cannot read, and profiles' RLS only exposes the caller's own row.
--
--  Because it runs as the postgres owner (a BYPASSRLS role), the `where is_admin()`
--  below is the ONLY thing stopping any signed-in member from reading every family
--  email address. is_admin() is evaluated per request against auth.uid(), so a
--  non-admin simply gets zero rows.
create or replace view public.members_admin
  with (security_invoker = false) as
  select
    p.id,
    p.full_name,
    u.email,
    p.is_admin,
    p.approved,
    p.person_id,
    p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin();

-- READ-ONLY, and the revoke is NOT optional — same trap as migration_v12.
-- Supabase's default privileges auto-grant ALL to anon + authenticated on new public
-- objects, and a definer-rights view owned by a BYPASSRLS role turns those writes into
-- RLS-bypassing writes on profiles. RLS is not a backstop here; the grants are.
-- anon gets nothing at all: this view is for signed-in admins only.
revoke all on public.members_admin from anon, authenticated;
grant select on public.members_admin to authenticated;

-- 2) The only write path ------------------------------------------------------
--  Flips profiles.approved after re-checking is_admin(). Deliberately cannot touch
--  is_admin itself — granting admin stays a manual SQL operation, so a compromised
--  member session can never escalate to admin through this endpoint.
create or replace function public.set_member_approved(target_id uuid, approve boolean)
  returns boolean
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  update public.profiles set approved = approve where id = target_id;
  if not found then
    raise exception 'no such profile: %', target_id;
  end if;
  return approve;
end; $$;

revoke all on function public.set_member_approved(uuid, boolean) from public;
grant execute on function public.set_member_approved(uuid, boolean) to authenticated;
