-- Turns on Row Level Security for every table and view the dashboard reads, and
-- grants the `anon` role read-only (SELECT) access to exactly those objects.
--
-- Run in the Supabase SQL editor of the MAIN project (the one behind
-- VITE_SUPABASE_URL). The `submissions` table lives in a different project; see
-- sql/enable-rls-submissions.sql.
--
-- BEFORE running, confirm what key the external sync server writes with. The
-- service-role key bypasses RLS and is unaffected. If it uses the anon key, its
-- writes to deals / stage_transitions / sync_state will start failing, because
-- this file grants anon SELECT only.
--
-- What this does NOT do: make the data private. The browser authenticates as
-- `anon` and the anon key ships in the bundle, so anyone holding it can still
-- read these objects. What changes is that anon can no longer INSERT, UPDATE or
-- DELETE. Real read restriction needs a server-side proxy or Supabase Auth.
--
-- Safe to re-run: each policy is dropped before it is created.
-- Rollback is at the bottom of the file.

-- 1. Tables -------------------------------------------------------------------

alter table public.deals              enable row level security;
alter table public.associates         enable row level security;
alter table public.clients            enable row level security;
alter table public.stage_transitions  enable row level security;
alter table public.sync_state         enable row level security;

drop policy if exists "anon read deals" on public.deals;
create policy "anon read deals"
  on public.deals for select to anon using (true);

drop policy if exists "anon read associates" on public.associates;
create policy "anon read associates"
  on public.associates for select to anon using (true);

drop policy if exists "anon read clients" on public.clients;
create policy "anon read clients"
  on public.clients for select to anon using (true);

drop policy if exists "anon read stage_transitions" on public.stage_transitions;
create policy "anon read stage_transitions"
  on public.stage_transitions for select to anon using (true);

drop policy if exists "anon read sync_state" on public.sync_state;
create policy "anon read sync_state"
  on public.sync_state for select to anon using (true);

-- 2. Views --------------------------------------------------------------------
-- A view runs with its owner's rights by default, so it bypasses RLS on the
-- tables underneath and RLS above would not cover it. security_invoker makes it
-- run as the caller, so the stage_transitions policy applies to it too.
-- Requires Postgres 15+ (all current Supabase projects).

alter view public.stage_duration_stats   set (security_invoker = true);
alter view public.stage_transition_counts set (security_invoker = true);

-- Views take no policies of their own; they need the grant instead.
grant select on public.stage_duration_stats    to anon;
grant select on public.stage_transition_counts to anon;

-- 3. Not touched --------------------------------------------------------------
-- public.records (Google Drive deal-document tracking) is unrelated to the
-- dashboard and may be written by another tool, so it is deliberately left
-- alone. Enable RLS on it separately once you know what writes to it.

-- 4. Verify -------------------------------------------------------------------
-- Every dashboard table should show rowsecurity = true and one policy:
--
--   select c.relname, c.relrowsecurity as rls_on, count(p.policyname) as policies
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--   left join pg_policies p on p.schemaname = n.nspname and p.tablename = c.relname
--   where n.nspname = 'public' and c.relkind = 'r'
--   group by c.relname, c.relrowsecurity
--   order by c.relname;
--
-- Then reload the dashboard: row counts and names should match what they were.

-- 5. Rollback -----------------------------------------------------------------
-- Run only if the app goes blank and you need it back immediately.
--
--   alter table public.deals              disable row level security;
--   alter table public.associates         disable row level security;
--   alter table public.clients            disable row level security;
--   alter table public.stage_transitions  disable row level security;
--   alter table public.sync_state         disable row level security;
--   alter view  public.stage_duration_stats    set (security_invoker = false);
--   alter view  public.stage_transition_counts set (security_invoker = false);
