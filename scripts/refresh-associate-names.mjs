// Refreshes the `associates` table in Supabase from Bitrix24's user list.
//
// Supabase has no join from deals.assigned_by_id to a name, so this table is
// what stops the dashboard rendering "Associate #<id>". It also carries each
// person's email, which is the only associate identifier the submissions rows
// have -- one Bitrix call answers both, which is why the two hand-maintained
// files this replaced kept drifting out of agreement with each other.
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

for (const user of users) {
  const id = Number(user.ID);
  const fullName = `${user.NAME || ''} ${user.LAST_NAME || ''}`.replace(/\s+/g, ' ').trim();
  if (!fullName) continue;

  const email = (user.EMAIL || '').trim().toLowerCase();
  const claimable = email && !claimedEmails.has(email);
  if (claimable) claimedEmails.add(email);
  if (!claimable) withoutEmail += 1;

  rows.push({
    bitrix_id: id,
    full_name: fullName,
    email: claimable ? email : null,
    // ACTIVE comes back on the record even though it can't be used as a query
    // filter (see fetchAllBitrixUsers). Bitrix has returned it as both a
    // boolean and a Y/N string, so treat anything else as active.
    is_active: user.ACTIVE !== false && user.ACTIVE !== 'N',
    synced_at: syncedAt,
  });
}

const supabase = createAdminClient();
await upsertAll(supabase, 'associates', rows);
console.log(`associates table upserted: ${rows.length} rows (${rows.length - withoutEmail} with an email)`);
