-- ============================================================================
--  Kong Zupu — Stage 2 migration: approved-member tier + gated living detail
--  Run ONCE in Supabase SQL editor, BEFORE seed_living_members.sql.
--  Effect:
--    • adds profiles.approved  (admin vets a member before they see living detail)
--    • person_details holds birth year / bio for LIVING members, readable only by
--      admins, approved members, or the person themself. Deceased people keep their
--      detail in persons (public). Non-approved members thus see living people as a
--      BASIC skeleton (name + position) only.
-- ============================================================================

alter table profiles add column if not exists approved boolean not null default false;

create or replace function is_approved() returns boolean language sql stable as $$
  select coalesce((select approved from profiles where id = auth.uid()), false)
      or coalesce((select is_admin  from profiles where id = auth.uid()), false);
$$;

-- detail table (person_id is text to match the existing seed-style ids)
create table if not exists person_details (
  person_id   text primary key,
  birth_year  text,
  death_year  text,
  lifespan    text,
  religion    text,
  occupation  text,
  bio         text,
  updated_at  timestamptz not null default now()
);
alter table person_details enable row level security;

-- Read: admins / approved members / self always; plus anyone for details of a
-- PUBLIC (deceased, non-minor) person — so public bios still render for visitors.
drop policy if exists person_details_read on person_details;
create policy person_details_read on person_details for select using (
  is_approved()
  or person_id = (select person_id from profiles where id = auth.uid())
  or exists (select 1 from persons p
             where p.id = person_details.person_id
               and p.visibility = 'public' and p.is_minor = false)
);
drop policy if exists person_details_write on person_details;
create policy person_details_write on person_details for all using (is_admin()) with check (is_admin());

-- To approve a member after they sign up:
--   update profiles set approved = true where id = (select id from auth.users where email = 'them@example.com');
