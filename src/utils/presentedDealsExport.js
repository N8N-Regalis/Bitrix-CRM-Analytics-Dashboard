import { getStageLabel } from '@/utils/dealMeta';

/**
 * The two datasets behind the Presented Deals table, shaped for export.
 *
 * The page's figures are two independent counts over two databases (see
 * useSubmissions), so the export keeps them apart the same way: one tab of the
 * submission rows the Sourced Deals column counted, one tab of the deal rows
 * the Presented Deals columns counted. Both carry the associate and client
 * names the page grouped them under, so a number in the table can be traced to
 * the exact rows that produced it.
 *
 * Rows arrive already filtered to what the table is showing -- the same date
 * range and the same search -- so nothing is re-derived here.
 */

export const SOURCED_SHEET_NAME = 'Sourced';
export const PRESENTED_SHEET_NAME = 'Presented Deals';

const OUTCOME_LABELS = {
  accepted: 'Accepted',
  rejected: 'Rejected',
  autoAxed: 'Auto-Axed Deals',
  onHold: 'On Hold',
  awaiting: 'Awaiting Response',
};

// A presented deal whose move out of Video Presentation was never recorded is
// counted under Presented but lands in none of the breakdown columns (see
// resolveOutcome). Labelling that explicitly is what makes the tab reconcile:
// these rows are the difference between Total and the four columns summed.
const UNCLASSIFIED_OUTCOME = 'Not recorded';

const PRESENTED_COLUMNS = [
  { key: 'associate_name', header: 'Associate' },
  { key: 'team', header: 'Team' },
  { key: 'client_name', header: 'Client' },
  { key: 'presented_date', header: 'Presented Date (UTC)' },
  { key: 'outcome', header: 'Outcome' },
  { key: 'current_stage', header: 'Current Stage' },
  { key: 'deal_id', header: 'Deal ID' },
  { key: 'stage_id', header: 'Current Stage Code' },
  { key: 'assigned_by_id', header: 'Assigned By ID' },
  { key: 'contact_id', header: 'Contact ID' },
  { key: 'team_lead_id', header: 'Deal Team Lead ID' },
  { key: 'presented_date_raw', header: 'Presented Date (as sent by Bitrix)' },
];

// The three fields the page groups and filters on, pinned to the front of the
// Sourced tab. Everything else on a submission row follows in the order
// Supabase returned it, untouched.
const SOURCED_LEAD_COLUMNS = [
  { key: 'associate_name', header: 'Associate' },
  { key: 'team', header: 'Team' },
  { key: 'client_name', header: 'Client (matched)' },
  { key: 'source_date', header: 'Source Date (UTC)' },
];

// Headers for the raw columns whose names alone would not say what they hold.
// Anything not listed is title-cased from its column name.
const SOURCED_HEADERS = {
  id: 'Submission ID',
  user_email: 'Sourcer Email (raw)',
  sourcer_email: 'Sourcer Email (normalized)',
  partner_name: 'Partner Name (as typed)',
  timestamp: 'Submitted At',
  month_num: 'Month Number',
  cim_received: 'CIM Received',
  is_duplicate: 'Duplicate?',
  duplicate_of: 'Duplicate Of',
};

function humanize(key) {
  return key
    .split('_')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/**
 * Every column present on the submission rows, lead columns first.
 *
 * Discovered from the data rather than hard-coded, because the submissions
 * table is read with `select('*')` and owned by another app -- a column added
 * there should turn up in the export instead of being silently dropped.
 */
function sourcedColumns(rows) {
  const lead = new Set(SOURCED_LEAD_COLUMNS.map((column) => column.key));
  const seen = new Set();
  const rest = [];

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (lead.has(key) || seen.has(key)) continue;
      seen.add(key);
      rest.push({ key, header: SOURCED_HEADERS[key] ?? humanize(key) });
    }
  }

  return [...SOURCED_LEAD_COLUMNS, ...rest];
}

function toPresentedRow(deal) {
  return {
    associate_name: deal.associateName,
    team: deal.team,
    client_name: deal.clientName,
    presented_date: deal.presentedDate,
    outcome: OUTCOME_LABELS[deal.outcome] ?? UNCLASSIFIED_OUTCOME,
    current_stage: getStageLabel(deal.stageId),
    deal_id: deal.dealId,
    stage_id: deal.stageId,
    assigned_by_id: deal.assignedById,
    contact_id: deal.contactId,
    team_lead_id: deal.teamLeadId,
    presented_date_raw: deal.presentedDateRaw,
  };
}

export function buildSourcedSheet(rows) {
  return { name: SOURCED_SHEET_NAME, columns: sourcedColumns(rows), rows };
}

export function buildPresentedSheet(rows) {
  return { name: PRESENTED_SHEET_NAME, columns: PRESENTED_COLUMNS, rows: rows.map(toPresentedRow) };
}

/** Both tabs, in the order they appear in the workbook. */
export function buildPresentedDealsSheets({ sourced, presented }) {
  return [buildSourcedSheet(sourced), buildPresentedSheet(presented)];
}

/**
 * Base filename carrying the applied date range, so files pulled on different
 * days or for different windows don't overwrite each other in the downloads
 * folder. Matches the range the page states above the table.
 */
export function presentedDealsFileName(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return 'presented-deals_all-dates';
  if (dateFrom === dateTo) return `presented-deals_${dateFrom}`;
  return `presented-deals_${dateFrom}_to_${dateTo}`;
}
