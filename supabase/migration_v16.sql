-- ============================================================================
--  Kong Zupu — migration v16: promote a family member to reviewer (admin)
--
--  Until now the only way to add a reviewer was to edit profiles.is_admin by hand
--  in the SQL editor. This mirrors set_member_approved so the Members tab can do
--  it, with two guards worth keeping:
--    • only an existing admin may promote or demote anyone (re-checked here, not
--      just hidden in the UI);
--    • nobody may demote themselves — the last admin doing that would lock the
--      Members and Review tabs behind a flag no one could set back.
--
--  A reviewer can approve contributions, edit and archive people, approve members
--  and see living relatives' private detail. Only give it to family you'd trust
--  with all of that.
--
--  RUN ORDER: after migration_v15.sql. Safe to re-run.
-- ============================================================================

create or replace function public.set_member_admin(target_id uuid, make_admin boolean)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if target_id = auth.uid() and make_admin = false then
    raise exception 'you cannot remove your own reviewer access';
  end if;
  update public.profiles
     set is_admin = make_admin,
         approved = case when make_admin then true else approved end   -- a reviewer is always an approved member
   where id = target_id;
  if not found then
    raise exception 'no such profile: %', target_id;
  end if;
  return make_admin;
end; $$;

revoke all on function public.set_member_admin(uuid, boolean) from public, anon;
grant execute on function public.set_member_admin(uuid, boolean) to authenticated;

comment on function public.set_member_admin is
  'Admin-only: grant or remove reviewer (is_admin) rights. Refuses self-demotion.';
