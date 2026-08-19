// Refreshes the associate roster from Bitrix24's live user list.
//
// Currently dual-writes, on the way to retiring the snapshot entirely:
//   - `associates` in Supabase, the new source of truth (id, name, email).
//   - src/utils/associateNames.js, the old build-time snapshot the app still
//     reads. Once the app reads the table, that half comes out of this script.
//
// This also subsumes src/utils/associateEmails.js: user.get returns EMAIL in
// the same payload as the name, so both files were always two projections of
// one call -- which is how the hand-maintained one drifted out of agreement.
//
// Requires BITRIX_WEBHOOK_BASE, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
// .env (all server-side only, never VITE_-prefixed).
//
// Usage: npm run refresh:associates

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAdminClient, upsertAll } from './supabaseAdmin.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'utils', 'associateNames.js');

const BITRIX_WEBHOOK_BASE = process.env.BITRIX_WEBHOOK_BASE;
if (!BITRIX_WEBHOOK_BASE) {
  console.error('Missing BITRIX_WEBHOOK_BASE in .env');
  process.exit(1);
}

// user.get pages 50 at a time. Deliberately unfiltered: deactivated employees
// still own historical deals, so excluding them would send those deals back to
// "Associate #<id>" the moment someone leaves. Note that passing ACTIVE=true or
// ACTIVE=false as a query param does NOT work on this endpoint -- both return
// the same 110 rows, while no filter returns all 176 (110 active + 66 not).
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

function escapeSingleQuotes(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function countPreviousEntries(outputPath) {
  if (!fs.existsSync(outputPath)) return 0;
  const existing = fs.readFileSync(outputPath, 'utf8');
  const matches = existing.match(/^\s*\d+:/gm);
  return matches ? matches.length : 0;
}

function buildFile(nameById, previousCount) {
  const ids = Object.keys(nameById).map(Number).sort((a, b) => a - b);
  const today = new Date().toISOString().slice(0, 10);
  const lines = ids.map((id) => `  ${id}: '${escapeSingleQuotes(nameById[id])}',`);

  const header = `// Snapshot of Bitrix24 user.get (id -> "First Last"), refreshed ${today}
// via scripts/refresh-associate-names.mjs.
// There is no associates/users table in Supabase, so this is a point-in-time
// mapping rather than a live lookup. New hires won't appear here until this
// snapshot is refreshed -- see getAssociateLabel's fallback for how unknown
// IDs render in the meantime. Includes deactivated users, who still own
// historical deals. The proper long-term fix is for the sync server to write
// a \`users\` table into Supabase; this file is a stopgap until then.
// Previous snapshot had ${previousCount} entries; this one has ${ids.length}.
export const ASSOCIATE_NAMES = {
`;

  return header + lines.join('\n') + '\n};\n';
}

const previousCount = countPreviousEntries(OUTPUT_PATH);
const users = await fetchAllBitrixUsers();

const syncedAt = new Date().toISOString();
const nameById = {};
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

  nameById[id] = fullName;

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

fs.writeFileSync(OUTPUT_PATH, buildFile(nameById, previousCount));

const newCount = Object.keys(nameById).length;
const delta = newCount - previousCount;
console.log(`associateNames.js refreshed: ${previousCount} -> ${newCount} (${delta >= 0 ? '+' : ''}${delta})`);

const supabase = createAdminClient();
await upsertAll(supabase, 'associates', rows);
console.log(`associates table upserted: ${rows.length} rows (${rows.length - withoutEmail} with an email)`);
