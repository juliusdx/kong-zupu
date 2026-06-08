-- ============================================================================
--  HOTFIX: "Database error saving new user" on sign-up
--  Cause: the original handle_new_user() had no search_path, so the security-
--  definer trigger couldn't find the `profiles` table during auth sign-up.
--  Run this once in the Supabase SQL Editor, then try the magic link again.
-- ============================================================================
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
