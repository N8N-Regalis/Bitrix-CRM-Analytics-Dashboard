import { cleanName, nameKey } from '@/utils/nameMatch';
import {
  getNameRevision,
  lookupAssociateName,
  lookupAssociateNameByEmail,
  lookupClientName,
  lookupClientStatus,
  liveClientNames,
} from '@/utils/nameRegistry';

// Stage and pipeline labels are not stored in Supabase (Bitrix24 only syncs raw
// codes), so this mapping is maintained by hand from Bitrix CRM pipeline settings.
export const STAGE_LABELS = {
  INTRO_CALL: 'Broker Intro Call',
  NEW: 'M&A Associates Responsibilities',
  FINANCIAL_MODEL: 'Valuation Modeling',
  ACTION_REQUIRED: 'Action Required',
  MODEL_REVIEW: 'Valuation Model For Review',
  DEAL_PRESENTATION: 'Video Presentation',
  IOI_STAGE: 'IOI Stage',
  SELLER_CALL: 'Seller Call',
  POST_SELLER: 'Post Seller Call',
  NEGOTIATION: 'LOI Stage',
  COUNTER_NEGO: 'Counter/Negotiations',
  DUE_DILIGENCE: 'Post LOI Stage',
  LENDER: 'Package Submitted',
  LEGALITIES: 'Term Sheet',
  LAST_PHASE: 'Closing',
  HOLD: 'On Hold',
  WON: 'Deal Closed',
  LOSE: 'Axed',
};

// Funnel order, from the Bitrix pipeline configuration. HOLD and LOSE are
// off-funnel outcomes but are kept at the end for chart ordering.
export const STAGE_ORDER = [
  'INTRO_CALL',
  'NEW',
  'FINANCIAL_MODEL',
  'ACTION_REQUIRED',
  'MODEL_REVIEW',
  'DEAL_PRESENTATION',
  'IOI_STAGE',
  'SELLER_CALL',
  'POST_SELLER',
  'NEGOTIATION',
  'COUNTER_NEGO',
  'DUE_DILIGENCE',
  'LENDER',
  'LEGALITIES',
  'LAST_PHASE',
  'WON',
  'HOLD',
  'LOSE',
];

// Only category_id 0 has ever been observed in the synced data (single pipeline).
export const PIPELINE_LABELS = {
  0: 'Deal Pipeline',
};

// "Presented" is not a stage in Bitrix -- it describes a deal that has been
// through the Video Presentation stage, and the only record of that is the
// Presented Date custom field the associate fills in. A deal counts as
// presented when this field has a value, which is the same rule the Bitrix
// dashboard reports on.
//
// This deliberately does not corroborate the date against the pipeline history
// in `stage_transitions`; see presentedDealsService.js for the 108 legitimately
// presented deals that requirement discarded.
//
// The sync server gives the field a dedicated (lowercased) column on `deals`
// and also mirrors it inside raw_json; the column is what this app reads. Empty
// string, not null, is what Bitrix sends for "not set", so both have to be
// treated as missing.
export const PRESENTED_DATE_FIELD = 'uf_crm_1768236671239';

// Where a presented deal went next, as a stage code -> column mapping. Moving
// on into the funnel is the client accepting the deal, moving to Axed is the
// client rejecting it, and moving to On Hold is the decision being parked.
//
// Raw Bitrix stage codes rather than the labels above, because that is what
// `stage_transitions` stores. Keep in sync with STAGE_LABELS. Adding a stage
// here adds it to that column; a destination absent from this map (Valuation
// Model For Review, a bounce back to an earlier stage) leaves the deal counted
// under Presented only.
export const PRESENTATION_STAGE = 'DEAL_PRESENTATION';

// Accepted is every stage that carries the deal *forward* past Video
// Presentation, not just the four originally listed. A deal can skip a stage
// -- 9 went straight to Post Seller Call, jumping over Seller Call -- and
// landing further down the funnel is stronger evidence of acceptance than
// landing on the next stage, so excluding those undercounted. Listing them
// explicitly rather than deriving from STAGE_ORDER's position, because
// INTRO_CALL is an accepted destination that sits *before* Video Presentation
// in the funnel order.
export const PRESENTATION_OUTCOME_STAGES = {
  INTRO_CALL: 'accepted', // Broker Intro Call
  IOI_STAGE: 'accepted', // IOI Stage
  SELLER_CALL: 'accepted', // Seller Call
  POST_SELLER: 'accepted', // Post Seller Call
  NEGOTIATION: 'accepted', // LOI Stage
  COUNTER_NEGO: 'accepted', // Counter/Negotiations
  DUE_DILIGENCE: 'accepted', // Post LOI Stage
  LENDER: 'accepted', // Package Submitted
  LEGALITIES: 'accepted', // Term Sheet
  LAST_PHASE: 'accepted', // Closing
  WON: 'accepted', // Deal Closed
  LOSE: 'rejected', // Axed
  HOLD: 'onHold', // On Hold
};

// Moving a deal back to one of these is not a verdict on the presentation --
// it was sent back for rework and can still be accepted or rejected later. So
// a deal leaving Video Presentation for one of them isn't classified on that
// move; its later history is followed instead (see fetchPresentationOutcomes).
export const PRESENTATION_REWORK_STAGES = [
  'FINANCIAL_MODEL', // Valuation Modeling
  'NEW', // M&A Associates Responsibilities
  'MODEL_REVIEW', // Valuation Model For Review
];

function humanizeCode(code) {
  if (!code) return 'Unknown';
  const withoutCategoryPrefix = String(code).replace(/^C\d+:/, '');
  return withoutCategoryPrefix
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getStageLabel(stageId) {
  return STAGE_LABELS[stageId] || humanizeCode(stageId);
}

// Bitrix stage codes are always symbolic (NEW, WON, optionally 'C{n}:'-prefixed
// for non-default pipelines). crm.stagehistory has nonetheless emitted a handful
// of rows with a bare numeric STAGE_ID ('1') that matches no stage in
// crm.status.list -- a Bitrix artifact, not a pipeline stage. Stage analytics
// drop these so they can't surface as a phantom stage. Deliberately shape-based
// rather than "not in STAGE_LABELS": a genuinely new stage added in Bitrix but
// not yet mapped here (as happened with INTRO_CALL) still shows up as a raw
// humanized code, which is the signal that it needs mapping.
export function isRealStage(stageId) {
  return stageId != null && !/^\d+$/.test(String(stageId));
}

export function getPipelineLabel(categoryId) {
  return PIPELINE_LABELS[categoryId] ?? `Pipeline ${categoryId}`;
}

// deals.assigned_by_id is a bare Bitrix user id; the name lives in the
// `associates` table, loaded into nameRegistry once per app load. An id with no
// row is shown as-is rather than blanked, so an unsynced hire is still legible.
export function getAssociateLabel(assignedById) {
  if (assignedById === null || assignedById === undefined) return 'Unassigned';
  return lookupAssociateName(assignedById) || `Associate #${assignedById}`;
}

// A deal's contact_id is the buyer-side client it was sourced FOR (not the
// target company being evaluated -- that's the deal's title/company_id),
// resolved against the `clients` table.
export function getClientLabel(contactId) {
  if (contactId === null || contactId === undefined) return 'No Client';
  const name = lookupClientName(contactId);
  return name ? cleanName(name) : `Client #${contactId}`;
}

// Submissions rows identify their sourcer only by email address, so this is the
// same roster reached through a different key.
export function getAssociateLabelByEmail(email) {
  if (!email) return 'Unknown';
  return lookupAssociateNameByEmail(email) || email;
}

// Lookup tables for resolveClientName, rebuilt whenever the live overlay
// changes so a newly-fetched client can be matched immediately.
let clientNameIndex = null;
let clientNameIndexRevision = -1;

function firstLastKey(key) {
  const tokens = key.split(' ');
  return tokens.length < 2 ? null : `${tokens[0]} ${tokens[tokens.length - 1]}`;
}

function buildClientNameIndex() {
  const byFullName = new Map();
  const byFirstLast = new Map();
  const distinctPerFirstLast = new Map();

  // Set-deduped by canonical name, since two contacts can carry the same one.
  const allNames = new Set(liveClientNames());

  for (const name of allNames) {
    const canonical = cleanName(name);
    const key = nameKey(canonical);
    byFullName.set(key, canonical);

    const shortKey = firstLastKey(key);
    if (!shortKey) continue;
    if (!distinctPerFirstLast.has(shortKey)) distinctPerFirstLast.set(shortKey, new Set());
    distinctPerFirstLast.get(shortKey).add(key);
    byFirstLast.set(shortKey, canonical);
  }

  // A first+last shared by two *different* clients can't identify either of
  // them, so drop it rather than pick one. None collide in the current roster,
  // but this is checked at runtime so a future namesake can't cause a silent
  // mis-attribution -- such a name just falls back to no match.
  for (const [shortKey, fullKeys] of distinctPerFirstLast) {
    if (fullKeys.size > 1) byFirstLast.delete(shortKey);
  }

  return { byFullName, byFirstLast };
}

/**
 * Maps a hand-typed `submissions.partner_name` onto the canonical Bitrix client
 * name, so both sides of the Presented Deals join agree (see nameMatch.js).
 *
 * Exact match wins. Failing that, a name is resolved on first + last name alone
 * when exactly one client in the roster carries that pair -- the residual
 * mismatch after whitespace normalization is almost entirely a middle name
 * present on one side only ("Kevin Foster McCoy" vs Bitrix's "Kevin McCoy").
 * Anything still unresolved is returned cleaned but unchanged, which surfaces
 * it as its own row instead of being guessed onto the wrong client.
 */
export function resolveClientName(partnerName) {
  const cleaned = cleanName(partnerName);
  if (!cleaned) return '';

  if (!clientNameIndex || clientNameIndexRevision !== getNameRevision()) {
    clientNameIndex = buildClientNameIndex();
    clientNameIndexRevision = getNameRevision();
  }
  const key = nameKey(cleaned);

  const exact = clientNameIndex.byFullName.get(key);
  if (exact) return exact;

  const shortKey = firstLastKey(key);
  return (shortKey && clientNameIndex.byFirstLast.get(shortKey)) || cleaned;
}

// A client's relationship-lifecycle status, carried on the same `clients` row
// as the name. Contacts whose Bitrix status maps to nothing recognized are
// stored as null, hence the fallback here rather than in the sync.
export function getClientStatus(contactId) {
  if (contactId === null || contactId === undefined) return 'Unassigned';
  return lookupClientStatus(contactId) || 'Unassigned';
}
