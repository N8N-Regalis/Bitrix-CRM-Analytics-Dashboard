-- Adds the "Team Leader Name" column that scripts/refresh-associate-names.mjs
-- writes, sourced from the Bitrix user field UF_USR_1779466932710.
--
-- Run this once in the Supabase SQL editor BEFORE the next refresh; until the
-- column exists every upsert in that script fails with PGRST204 (unknown
-- column) and the whole roster refresh aborts.
--
-- The rest of this schema was created by hand in the Supabase dashboard, so
-- this file is a record of the change rather than part of a migration runner --
-- nothing replays it automatically.

alter table public.associates
  add column if not exists team_leader_name text;

-- Free text as Bitrix stores it ("EA", "Rox", "Lemon"), not a user id: the
-- field is typed as a string on the Bitrix side and its values are short names
-- that do not reliably match any associates.full_name, so there is deliberately
-- no foreign key back to this table. NULL means "no leader recorded in Bitrix",
-- which is the majority of the roster.
comment on column public.associates.team_leader_name is
  'Bitrix user field UF_USR_1779466932710 ("Team Leader Name"). Free text short name, not a bitrix_id. NULL when unset in Bitrix.';

-- The roster is small (~180 rows) so grouping by this needs no index; add one
-- only if it ever backs a filter over a much larger table.
