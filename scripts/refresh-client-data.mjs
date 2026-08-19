// Refreshes the client roster from Bitrix24's live contact list.
//
// Currently dual-writes, on the way to retiring the snapshots entirely:
//   - `clients` in Supabase, the new source of truth (id, name, status).
//   - src/utils/clientNames.js and src/utils/clientStatus.js, the old
//     build-time snapshots the app still reads. Once the app reads the table,
//     that half comes out of this script.
//
// Requires BITRIX_WEBHOOK_BASE, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
// .env (all server-side only, never VITE_-prefixed).
//
// Usage: npm run refresh:clients

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLIENT_STATUS_FIELD, CLIENT_STATUS_LOOKUP } from '../src/utils/clientFields.js';
import { createAdminClient, upsertAll } from './supabaseAdmin.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NAMES_OUTPUT_PATH = path.join(__dirname, '..', 'src', 'utils', 'clientNames.js');
const STATUS_OUTPUT_PATH = path.join(__dirname, '..', 'src', 'utils', 'clientStatus.js');

const BITRIX_WEBHOOK_BASE = process.env.BITRIX_WEBHOOK_BASE;
if (!BITRIX_WEBHOOK_BASE) {
  console.error('Missing BITRIX_WEBHOOK_BASE in .env');
  process.exit(1);
}

async function fetchAllBitrixContacts() {
  const contacts = [];
  let start = 0;
  let hasMore = true;

  while (hasMore) {
    const url = `${BITRIX_WEBHOOK_BASE}/crm.contact.list.json?start=${start}&select[]=ID&select[]=NAME&select[]=LAST_NAME&select[]=${CLIENT_STATUS_FIELD}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error_description || data.error || `Bitrix API error (HTTP ${response.status})`);
    }

    if (data.result && data.result.length > 0) {
      contacts.push(...data.result);
      hasMore = data.next !== undefined;
      start = data.next ?? start;
    } else {
      hasMore = false;
    }
  }

  return contacts;
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

function buildNamesFile(nameById, previousCount) {
  const ids = Object.keys(nameById).map(Number).sort((a, b) => a - b);
  const today = new Date().toISOString().slice(0, 10);
  const lines = ids.map((id) => `  ${id}: '${escapeSingleQuotes(nameById[id])}',`);

  const header = `// Snapshot of Bitrix24 crm.contact.list (id -> "First Last"), refreshed ${today}
// via scripts/refresh-client-data.mjs.
// In this Bitrix instance, a deal's contact_id is the buyer-side client the
// deal was sourced FOR (not the target company being evaluated -- that's the
// deal's title/company_id).
//
// This is a point-in-time snapshot, not a live lookup (there is no
// contacts/clients table in Supabase), so it WILL drift as new clients are
// added in Bitrix. Additions are bursty/irregular, not continuous -- re-run
// \`npm run refresh:clients\` whenever a deal shows "Client #<id>" instead of
// a name, or periodically. Previous snapshot had ${previousCount} entries; this one has ${ids.length}.
export const CLIENT_NAMES = {
`;

  return header + lines.join('\n') + '\n};\n';
}

function buildStatusFile(statusById, previousCount) {
  const ids = Object.keys(statusById).map(Number).sort((a, b) => a - b);
  const today = new Date().toISOString().slice(0, 10);
  const lines = ids.map((id) => `  ${id}: '${escapeSingleQuotes(statusById[id])}',`);

  const header = `// Snapshot of Bitrix24 crm.contact.list's client-status custom field
// (id -> status label, resolved via CLIENT_STATUS_LOOKUP in clientFields.js),
// refreshed ${today} via scripts/refresh-client-data.mjs.
//
// This is a point-in-time snapshot, not a live lookup -- same staleness
// caveats as clientNames.js. Re-run \`npm run refresh:clients\` to update both
// together. Contacts with no recognized status are omitted (getClientStatus
// in dealMeta.js falls back to 'Unassigned'). Previous snapshot had ${previousCount} entries; this one has ${ids.length}.
export const CLIENT_STATUS = {
`;

  return header + lines.join('\n') + '\n};\n';
}

const previousNamesCount = countPreviousEntries(NAMES_OUTPUT_PATH);
const previousStatusCount = countPreviousEntries(STATUS_OUTPUT_PATH);
const contacts = await fetchAllBitrixContacts();

const syncedAt = new Date().toISOString();
const nameById = {};
const statusById = {};
const rows = [];

// clients.full_name is NOT NULL, so a nameless contact can't become a row.
// Counted rather than ignored: if this is ever non-zero, a contact carrying a
// status but no name is being dropped from the table that clientStatus.js kept.
let namelessWithStatus = 0;

for (const contact of contacts) {
  const id = Number(contact.ID);
  const fullName = `${contact.NAME || ''} ${contact.LAST_NAME || ''}`.trim();
  if (fullName) {
    nameById[id] = fullName;
  }

  const statusLabel = CLIENT_STATUS_LOOKUP[String(contact[CLIENT_STATUS_FIELD])];
  if (statusLabel) {
    statusById[id] = statusLabel;
  }

  if (fullName) {
    rows.push({
      bitrix_id: id,
      full_name: fullName,
      status: statusLabel ?? null,
      synced_at: syncedAt,
    });
  } else if (statusLabel) {
    namelessWithStatus += 1;
  }
}

fs.writeFileSync(NAMES_OUTPUT_PATH, buildNamesFile(nameById, previousNamesCount));
fs.writeFileSync(STATUS_OUTPUT_PATH, buildStatusFile(statusById, previousStatusCount));

const newNamesCount = Object.keys(nameById).length;
const namesDelta = newNamesCount - previousNamesCount;
console.log(`clientNames.js refreshed: ${previousNamesCount} -> ${newNamesCount} (${namesDelta >= 0 ? '+' : ''}${namesDelta})`);

const newStatusCount = Object.keys(statusById).length;
const statusDelta = newStatusCount - previousStatusCount;
console.log(`clientStatus.js refreshed: ${previousStatusCount} -> ${newStatusCount} (${statusDelta >= 0 ? '+' : ''}${statusDelta})`);

const supabase = createAdminClient();
await upsertAll(supabase, 'clients', rows);
console.log(`clients table upserted: ${rows.length} rows (${newStatusCount} with a status)`);
if (namelessWithStatus > 0) {
  console.warn(`  note: ${namelessWithStatus} contact(s) had a status but no name and were skipped`);
}
