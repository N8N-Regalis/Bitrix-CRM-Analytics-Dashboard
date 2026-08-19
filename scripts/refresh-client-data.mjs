// Refreshes the `clients` table in Supabase from Bitrix24's contact list.
//
// A deal's contact_id is the buyer-side client it was sourced FOR (not the
// target company being evaluated -- that's the deal's title/company_id), and
// Supabase has no join from it to a name. This table supplies both that name
// and the client's relationship-lifecycle status.
//
// Runs weekly from .github/workflows/refresh-names.yml; run it by hand after a
// new client is added if you don't want to wait for the schedule.
//
// Requires BITRIX_WEBHOOK_BASE, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
// .env (all server-side only, never VITE_-prefixed).
//
// Usage: npm run refresh:clients

import { CLIENT_STATUS_FIELD, CLIENT_STATUS_LOOKUP } from '../src/utils/clientFields.js';
import { createAdminClient, upsertAll } from './supabaseAdmin.mjs';

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

const contacts = await fetchAllBitrixContacts();

const syncedAt = new Date().toISOString();
const rows = [];

// clients.full_name is NOT NULL, so a nameless contact can't become a row.
// Counted rather than ignored: if this is ever non-zero, a contact carrying a
// status but no name is being dropped rather than silently mis-stored.
let namelessWithStatus = 0;
let withStatus = 0;

for (const contact of contacts) {
  const fullName = `${contact.NAME || ''} ${contact.LAST_NAME || ''}`.trim();
  const statusLabel = CLIENT_STATUS_LOOKUP[String(contact[CLIENT_STATUS_FIELD])];

  if (!fullName) {
    if (statusLabel) namelessWithStatus += 1;
    continue;
  }

  if (statusLabel) withStatus += 1;

  rows.push({
    bitrix_id: Number(contact.ID),
    full_name: fullName,
    status: statusLabel ?? null,
    synced_at: syncedAt,
  });
}

const supabase = createAdminClient();
await upsertAll(supabase, 'clients', rows);
console.log(`clients table upserted: ${rows.length} rows (${withStatus} with a status)`);
if (namelessWithStatus > 0) {
  console.warn(`  note: ${namelessWithStatus} contact(s) had a status but no name and were skipped`);
}
