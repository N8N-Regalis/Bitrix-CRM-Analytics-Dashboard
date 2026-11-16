-- Turns on RLS for `submissions` in the SEPARATE Supabase project
-- (euagtbotutlygqtzwrvm) that backs the React Deal Report App and is read by
-- src/services/submissionsService.js.
--
-- Run in that project's SQL editor, not the main one.
--
-- That project's other consumers (the React Deal Report App, any form or n8n
-- flow that inserts submissions) share this table. This grants anon SELECT
-- only, so if anything writes with the anon / publishable key, add an INSERT
-- policy for it below or its writes will be rejected. Writers using the
-- service-role key are unaffected.
--
-- Safe to re-run.

alter table public.submissions enable row level security;

drop policy if exists "anon read submissions" on public.submissions;
create policy "anon read submissions"
  on public.submissions for select to anon using (true);

-- Only if a form posts submissions with the publishable key:
--
--   drop policy if exists "anon insert submissions" on public.submissions;
--   create policy "anon insert submissions"
--     on public.submissions for insert to anon with check (true);

-- Rollback:
--   alter table public.submissions disable row level security;
