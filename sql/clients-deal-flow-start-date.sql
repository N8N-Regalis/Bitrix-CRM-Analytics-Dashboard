-- Adds the "Deal Flow Start Date" column that scripts/refresh-client-data.mjs
-- writes, sourced from the Bitrix contact field UF_CRM_1755184781147
-- (DEAL_FLOW_START_DATE_FIELD in src/utils/clientFields.js).
--
-- Run this once in the Supabase SQL editor BEFORE the next refresh; until the
-- column exists every upsert in that script fails with PGRST204 (unknown
-- column) and the whole client refresh aborts.
--
-- The rest of this schema was created by hand in the Supabase dashboard, so
-- this file is a record of the change rather than part of a migration runner --
-- nothing replays it automatically.

alter table public.clients
  add column if not exists deal_flow_start_date date;

-- `date`, not timestamptz: the Bitrix field is typed `date`, and every value
-- comes back as midnight in the portal timezone (e.g. "2024-11-28T03:00:00+03:00"
-- with the portal on +03:00). The time half is an artifact of Bitrix's
-- serialization, so storing it would invite off-by-one-day comparisons in a
-- dashboard whose readers are nowhere near +03:00. The sync writes the calendar
-- day only.
comment on column public.clients.deal_flow_start_date is
  'Bitrix contact field UF_CRM_1755184781147 ("Deal Flow Start Date"): the day the client entered deal flow. Calendar day as Bitrix records it, portal-local. NULL when unset in Bitrix.';

-- ~336 rows, so nothing here needs an index; add one only if this ever backs a
-- filter over a much larger table.
