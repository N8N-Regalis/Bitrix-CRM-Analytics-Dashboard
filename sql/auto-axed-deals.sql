-- Deals Bitrix has marked "Reason for Axed" = "Auto-axed - Partner did not
-- respond for 1 week" (field UF_CRM_1755636401, option 881).
--
-- The `deals` table has no column for that field and the sync that fills it is
-- not part of this repo, so scripts/refresh-auto-axed-deals.mjs keeps this
-- one-column table current instead. The Presented Deals page reads it to split
-- the Rejected figure: a presented deal whose latest exit from Video
-- Presentation went to Axed counts as "Auto-Axed Deals" when its
-- deal_id is in here, and as plain "Rejected Deals" when it is not.
--
-- Run once in the Supabase SQL editor of the MAIN project (the one behind
-- VITE_SUPABASE_URL), then run `npm run refresh:auto-axed` to fill it. Until
-- the table exists the page still loads, but every axed deal counts as plain
-- Rejected and the Auto-Axed column reads 0.
--
-- Writes come only from the refresh script, which uses the service-role key and
-- bypasses RLS. The browser's anon role gets SELECT and nothing else.
--
-- Safe to re-run.

create table if not exists public.auto_axed_deals (
  deal_id   bigint primary key,
  synced_at timestamptz not null default now()
);

comment on table public.auto_axed_deals is
  'Bitrix deals whose Reason for Axed (UF_CRM_1755636401) is option 881, "Auto-axed - Partner did not respond for 1 week". Maintained by scripts/refresh-auto-axed-deals.mjs.';

alter table public.auto_axed_deals enable row level security;

drop policy if exists "anon read auto_axed_deals" on public.auto_axed_deals;
create policy "anon read auto_axed_deals"
  on public.auto_axed_deals for select to anon using (true);

-- Rollback:
--   drop table public.auto_axed_deals;
