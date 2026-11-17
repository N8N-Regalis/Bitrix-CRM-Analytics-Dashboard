// Refreshes the `auto_axed_deals` table in Supabase from Bitrix24.
//
// The Presented Deals page splits Rejected into plain rejections and ones the
// system applied after a partner went quiet. Bitrix records that two ways on the
// deal: "Reason for Axed" = "Auto-axed - Partner did not respond for 1 week", or
// "Reason for Axed" = "Other - Internal" with "Other Reason (Please Specify)" =
// "Automatically Axed by Automation. Client failed to respond on the Automated
// follow-up for XX Days." The Supabase `deals` table carries neither field, so
// the ids of deals matching either are copied here instead.
//
// A deal can leave the set -- someone corrects the reason -- so this mirrors
// Bitrix rather than only adding to it: ids no longer returned are deleted.
//
// Runs from .github/workflows/refresh-names.yml; run it by hand when you need a
// fresh figure sooner.
//
// Requires BITRIX_WEBHOOK_BASE, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
// .env (all server-side only, never VITE_-prefixed).
//
// Usage: npm run refresh:auto-axed

import {
  AXED_REASON_FIELD,
  AUTO_AXED_REASON_ID,
  AUTO_AXED_REASON_LABEL,
  OTHER_INTERNAL_REASON_ID,
  OTHER_INTERNAL_REASON_LABEL,
  OTHER_REASON_TEXT_FIELD,
  AUTOMATION_AXED_TEXT,
} from '../src/utils/dealFields.js';
import { createAdminClient, upsertAll } from './supabaseAdmin.mjs';

const BITRIX_WEBHOOK_BASE = process.env.BITRIX_WEBHOOK_BASE;
if (!BITRIX_WEBHOOK_BASE) {
  console.error('Missing BITRIX_WEBHOOK_BASE in .env');
  process.exit(1);
}

const base = BITRIX_WEBHOOK_BASE.replace(/\/+$/, '');

async function bitrix(method, query) {
  const response = await fetch(`${base}/${method}.json?${query}`);
  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error_description || data.error || `Bitrix API error (HTTP ${response.status})`);
  }

  return data;
}

// Enumeration values are stored as option ids, and an id is only meaningful
// while it still points at the option it did when this was written. If someone
// deletes and recreates the option, 881 could quietly come to mean something
// else and this table would fill with the wrong deals -- so check the label
// first and stop rather than guess.
async function assertReasonOptionsUnchanged() {
  const { result } = await bitrix('crm.deal.fields', '');
  const items = result?.[AXED_REASON_FIELD]?.items ?? [];

  for (const [id, label] of [
    [AUTO_AXED_REASON_ID, AUTO_AXED_REASON_LABEL],
    [OTHER_INTERNAL_REASON_ID, OTHER_INTERNAL_REASON_LABEL],
  ]) {
    const option = items.find((item) => String(item.ID) === id);
    if (!option || option.VALUE !== label) {
      throw new Error(
        `Reason for Axed option ${id} is ${option ? `"${option.VALUE}"` : 'missing'}, ` +
          `expected "${label}". Update src/utils/dealFields.js before refreshing.`
      );
    }
  }

  if (!result?.[OTHER_REASON_TEXT_FIELD]) {
    throw new Error(`Deal field ${OTHER_REASON_TEXT_FIELD} (Other Reason) not found.`);
  }
}

// Pages through crm.deal.list and hands each deal to onDeal.
async function forEachDeal(query, onDeal) {
  let start = 0;
  let hasMore = true;

  while (hasMore) {
    const data = await bitrix('crm.deal.list', `start=${start}&${query}`);

    if (data.result && data.result.length > 0) {
      data.result.forEach(onDeal);
      hasMore = data.next !== undefined;
      start = data.next ?? start;
    } else {
      hasMore = false;
    }
  }
}

async function fetchAutoAxedDealIds() {
  const ids = new Set();

  // 1. The dedicated "Auto-axed - Partner did not respond for 1 week" reason.
  await forEachDeal(`select[]=ID&filter[${AXED_REASON_FIELD}]=${AUTO_AXED_REASON_ID}`, (deal) =>
    ids.add(Number(deal.ID))
  );
  const fromReason = ids.size;

  // 2. "Other - Internal" deals whose free-text reason is the automation's message.
  //    Matched in code rather than with a Bitrix LIKE filter, which is unreliable on
  //    multi-value fields; the Other - Internal set is only a few dozen deals.
  await forEachDeal(
    `select[]=ID&select[]=${OTHER_REASON_TEXT_FIELD}&filter[${AXED_REASON_FIELD}]=${OTHER_INTERNAL_REASON_ID}`,
    (deal) => {
      const raw = deal[OTHER_REASON_TEXT_FIELD];
      const texts = Array.isArray(raw) ? raw : [raw];
      if (texts.some((text) => typeof text === 'string' && AUTOMATION_AXED_TEXT.test(text))) {
        ids.add(Number(deal.ID));
      }
    }
  );

  console.log(`Auto-axed: ${fromReason} by reason option, ${ids.size - fromReason} by automation text`);
  return ids;
}

await assertReasonOptionsUnchanged();
const dealIds = await fetchAutoAxedDealIds();

const supabase = createAdminClient();
const syncedAt = new Date().toISOString();

await upsertAll(
  supabase,
  'auto_axed_deals',
  Array.from(dealIds, (dealId) => ({ deal_id: dealId, synced_at: syncedAt })),
  'deal_id'
);

// An empty result is far more likely a broken filter or a permissions change
// than every auto-axed deal being corrected at once, and acting on it would wipe
// the table. Keep the last good copy and say so.
if (dealIds.size === 0) {
  console.warn('Bitrix returned no auto-axed deals; leaving the table untouched.');
  process.exit(0);
}

const { data: existing, error } = await supabase.from('auto_axed_deals').select('deal_id');
if (error) throw new Error(`auto_axed_deals read failed: ${error.message}`);

const stale = existing.map((row) => row.deal_id).filter((dealId) => !dealIds.has(dealId));
for (let index = 0; index < stale.length; index += 500) {
  const { error: deleteError } = await supabase
    .from('auto_axed_deals')
    .delete()
    .in('deal_id', stale.slice(index, index + 500));
  if (deleteError) throw new Error(`auto_axed_deals delete failed: ${deleteError.message}`);
}

console.log(`auto_axed_deals refreshed: ${dealIds.size} deals (${stale.length} removed)`);
