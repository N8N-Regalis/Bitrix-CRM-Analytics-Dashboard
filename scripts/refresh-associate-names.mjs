// Refreshes the `associates` table in Supabase from Bitrix24's user list.
//
// Supabase has no join from deals.assigned_by_id to a name, so this table is
// what stops the dashboard rendering "Associate #<id>". It also carries each
// person's email, which is the only associate identifier the submissions rows
// have, plus their team leader -- one Bitrix call answers all three, which is
// why the two hand-maintained files this replaced kept drifting out of
// agreement with each other.
//
// Runs weekly from .github/workflows/refresh-names.yml; run it by hand after a
// new hire if you don't want to wait for the schedule.
//
// Requires BITRIX_WEBHOOK_BASE, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
// .env (all server-side only, never VITE_-prefixed).
//
// Usage: npm run refresh:associates

import { createAdminClient, upsertAll } from './supabaseAdmin.mjs';

const BITRIX_WEBHOOK_BASE = process.env.BITRIX_WEBHOOK_BASE;
if (!BITRIX_WEBHOOK_BASE) {
  console.error('Missing BITRIX_WEBHOOK_BASE in .env');
  process.exit(1);
}

// The Bitrix user field labelled "Team Leader Name" (confirm with user.fields).
// Free text holding the leader's short name -- "EA", "Rox", "Lemon" -- not a
// user id. Lives here rather than in a shared util because the sync is its only
// consumer: the app reads the resulting columns out of Supabase, never this
// field id.
//
// Distinct from TEAM_LEAD_FIELD in src/utils/clientFields.js, which is a
// contact-side UF_CRM field with the same human name.
const TEAM_LEADER_FIELD = 'UF_USR_1779466932710';

// Bitrix records the leader as a nickname with no link back to their user
// record, and the nicknames don't survive being matched against full_name:
// "EA" substring-hits eight unrelated people (Leandroff, Alleah, Althea...)
// and "Lemon" hits nobody. So this map is the only route from the field to an
// associate, and it is knowledge Bitrix does not hold -- confirmed by hand
// rather than derived. Update it on a reorg or a new team lead.
const TEAM_LEADER_IDS = {
  EA: 53, // Emmanuel Dominguez Amboya
  Rox: 35, // Ma. Roxette Molina Rojas
  Lemon: 23, // Lemmuel Rafael De Guzman
  Moeez: 237, // Moeez Ul Hassan Khan
  Racquel: 69, // Racquel Alonzo Moran
  Clarisse: 41, // Clarisse Genica Ruiz Arbolante
};

// user.get pages 50 at a time. Deliberately unfiltered: deactivated employees
// still own historical deals, so excluding them would send those deals back to
// "Associate #<id>" the moment someone leaves. Note that passing ACTIVE=true or
// ACTIVE=false as a query param does NOT work on this endpoint -- both return
// the same 110 rows, while no filter returns all of them (active and not).
async function fetchAllBitrixUsers() {
  const users = [];
  let start = 0;
  let hasMore = true;

  while (hasMore) {
    const url = `${BITRIX_WEBHOOK_BASE}/user.get.json?start=${start}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error_description || data.error || `Bitrix API error (HTTP ${response.status})`);
    }

    if (data.result && data.result.length > 0) {
      users.push(...data.result);
      hasMore = data.next !== undefined;
      start = data.next ?? start;
    } else {
      hasMore = false;
    }
  }

  return users;
}

const users = await fetchAllBitrixUsers();

const syncedAt = new Date().toISOString();
const rows = [];

// associates.email has a unique index on lower(email), and Bitrix does hand out
// the same address to duplicate accounts. First occurrence keeps the address;
// later ones go in without one, so one duplicate can't fail the whole batch.
const claimedEmails = new Set();
let withoutEmail = 0;
let withTeamLeader = 0;

// A nickname Bitrix uses that TEAM_LEADER_IDS has no entry for. Collected
// rather than ignored because the row still upserts -- with a null
// team_leader_id -- so a new team lead would otherwise drop a whole team out of
// any rollup that joins on the id, silently and indefinitely.
const unmappedLeaders = new Set();

for (const user of users) {
  const id = Number(user.ID);
  const fullName = `${user.NAME || ''} ${user.LAST_NAME || ''}`.replace(/\s+/g, ' ').trim();
  if (!fullName) continue;

  const email = (user.EMAIL || '').trim().toLowerCase();
  const claimable = email && !claimedEmails.has(email);
  if (claimable) claimedEmails.add(email);
  if (!claimable) withoutEmail += 1;

  // user.get returns every UF_ field on the record, so no select[] is needed --
  // but Bitrix omits the key entirely on users who have never had one set,
  // which is why this reads through `|| ''` rather than trusting it exists.
  const teamLeader = String(user[TEAM_LEADER_FIELD] || '').trim();
  if (teamLeader) withTeamLeader += 1;
  if (teamLeader && !(teamLeader in TEAM_LEADER_IDS)) unmappedLeaders.add(teamLeader);

  rows.push({
    bitrix_id: id,
    full_name: fullName,
    email: claimable ? email : null,
    // Null, not '', for the unset case: the column is what an "unassigned"
    // grouping keys off, and two spellings of empty would split that bucket.
    team_leader_name: teamLeader || null,
    team_leader_id: TEAM_LEADER_IDS[teamLeader] ?? null,
    // ACTIVE comes back on the record even though it can't be used as a query
    // filter (see fetchAllBitrixUsers). Bitrix has returned it as both a
    // boolean and a Y/N string, so treat anything else as active.
    is_active: user.ACTIVE !== false && user.ACTIVE !== 'N',
    synced_at: syncedAt,
  });
}

// team_leader_id is a self-referential foreign key and upsertAll splits the
// batch into separate requests, so each chunk is its own transaction: a leader
// landing in a later chunk than their reports would fail those reports' FK
// check. Sorting the six leader rows to the front makes that impossible --
// they all fit in chunk one, and the hierarchy is only two levels deep (no
// leader has a leader), so nothing they reference needs ordering in turn.
const leaderIds = new Set(Object.values(TEAM_LEADER_IDS));
rows.sort((a, b) => Number(leaderIds.has(b.bitrix_id)) - Number(leaderIds.has(a.bitrix_id)));

const supabase = createAdminClient();
await upsertAll(supabase, 'associates', rows);
console.log(
  `associates table upserted: ${rows.length} rows ` +
    `(${rows.length - withoutEmail} with an email, ${withTeamLeader} with a team leader)`
);
if (unmappedLeaders.size > 0) {
  console.warn(
    `  WARNING: no TEAM_LEADER_IDS entry for ${[...unmappedLeaders].map((n) => `"${n}"`).join(', ')} ` +
      `-- their reports have a team_leader_name but a null team_leader_id. Add them to the map in this file.`
  );
}
