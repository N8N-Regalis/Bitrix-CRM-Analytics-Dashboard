// Refreshes the `clients` table in Supabase from Bitrix24's contact list.
//
// A deal's contact_id is the buyer-side client it was sourced FOR (not the
// target company being evaluated -- that's the deal's title/company_id), and
// Supabase has no join from it to a name. This table supplies that name, the
// client's relationship-lifecycle status, and the day they entered deal flow.
//
// Runs weekly from .github/workflows/refresh-names.yml; run it by hand after a
// new client is added if you don't want to wait for the schedule.
//
// Requires BITRIX_WEBHOOK_BASE, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
// .env (all server-side only, never VITE_-prefixed).
//
// Usage: npm run refresh:clients

import {
  CLIENT_STATUS_FIELD,
  CLIENT_STATUS_LOOKUP,
  DEAL_FLOW_START_DATE_FIELD,
} from '../src/utils/clientFields.js';
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
    const url = `${BITRIX_WEBHOOK_BASE}/crm.contact.list.json?start=${start}&select[]=ID&select[]=NAME&select[]=LAST_NAME&select[]=${CLIENT_STATUS_FIELD}&select[]=${DEAL_FLOW_START_DATE_FIELD}`;
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

// Bitrix serializes its `date` fields as a full timestamp at midnight in the
// portal timezone -- every value on the contact list reads "T03:00:00+03:00" --
// so the calendar day is the leading YYYY-MM-DD and the rest of the string is
// serialization noise. Sliced rather than parsed: `new Date(...)` re-anchors
// the instant to whichever zone reads it back, and that only agrees with the
// intended day while the portal's midnight happens to land on 00:00 UTC. Move
// the portal off +03:00 and half the roster silently shifts a day.
function toDateOnly(value) {
  const match = /^\d{4}-\d{2}-\d{2}/.exec(String(value ?? ''));
  return match ? match[0] : null;
}

const contacts = await fetchAllBitrixContacts();

const syncedAt = new Date().toISOString();
const rows = [];

// clients.full_name is NOT NULL, so a nameless contact can't become a row.
// Counted rather than ignored: if this is ever non-zero, a contact carrying a
// status but no name is being dropped rather than silently mis-stored.
let namelessWithStatus = 0;
let withStatus = 0;
let withDealFlowStart = 0;

for (const contact of contacts) {
  const fullName = `${contact.NAME || ''} ${contact.LAST_NAME || ''}`.trim();
  const statusLabel = CLIENT_STATUS_LOOKUP[String(contact[CLIENT_STATUS_FIELD])];
  const dealFlowStart = toDateOnly(contact[DEAL_FLOW_START_DATE_FIELD]);

  if (!fullName) {
    if (statusLabel) namelessWithStatus += 1;
    continue;
  }

  if (statusLabel) withStatus += 1;
  if (dealFlowStart) withDealFlowStart += 1;

  rows.push({
    bitrix_id: Number(contact.ID),
    full_name: fullName,
    status: statusLabel ?? null,
    // Null, not undefined: upsertAll sends the batch as one PostgREST request,
    // which requires every row to carry the same keys (see supabaseAdmin.mjs).
    deal_flow_start_date: dealFlowStart,
    synced_at: syncedAt,
  });
}

const supabase = createAdminClient();
await upsertAll(supabase, 'clients', rows);
console.log(
  `clients table upserted: ${rows.length} rows ` +
    `(${withStatus} with a status, ${withDealFlowStart} with a deal flow start date)`
);
if (namelessWithStatus > 0) {
  console.warn(`  note: ${namelessWithStatus} contact(s) had a status but no name and were skipped`);
}
