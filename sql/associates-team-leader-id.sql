-- Resolves associates.team_leader_name (a Bitrix short name like "EA" or
-- "Lemon") to the leader's own associates row, so team rollups can join rather
-- than group on a free-text string.
--
-- Run this once in the Supabase SQL editor BEFORE the next refresh; until the
-- column exists every upsert in scripts/refresh-associate-names.mjs fails with
-- PGRST204 (unknown column) and the whole roster refresh aborts.
--
-- Companion to associates-team-leader-name.sql. As with that one, this is a
-- record of a hand-applied change -- nothing replays it automatically.

alter table public.associates
  add column if not exists team_leader_id bigint;

-- Self-referential: a team leader is just another associate. The sync script
-- writes this by looking the short name up in TEAM_LEADER_IDS, so the
-- constraint is what turns a stale mapping (someone leaves, a nickname
-- changes) into a loud failure instead of a silently wrong id.
--
-- ON DELETE SET NULL because the sync never deletes rows, but a manual cleanup
-- of a departed employee shouldn't be blocked by their former reports.
alter table public.associates
  drop constraint if exists associates_team_leader_id_fkey;

alter table public.associates
  add constraint associates_team_leader_id_fkey
  foreign key (team_leader_id) references public.associates(bitrix_id)
  on delete set null;

comment on column public.associates.team_leader_id is
  'associates.bitrix_id of the person named in team_leader_name, resolved via the hand-maintained map in scripts/refresh-associate-names.mjs. NULL when no leader is set in Bitrix (which includes the leaders themselves).';

-- Postgres does not index a foreign key column automatically. At ~180 rows the
-- join cost is nil, but the index also keeps the ON DELETE SET NULL scan cheap
-- and costs nothing at this size.
create index if not exists associates_team_leader_id_idx
  on public.associates (team_leader_id);
