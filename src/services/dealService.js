import { supabase } from '@/services/supabase';
import { ensureLiveNames } from '@/services/namesService';
import { getStageLabel, getPipelineLabel, getAssociateLabel, getClientLabel, getClientStatus } from '@/utils/dealMeta';
import { toDayString } from '@/utils/dateRange';

const LIST_COLUMNS =
  'deal_id, title, stage_id, category_id, assigned_by_id, company_id, contact_id, opportunity, currency_id, created_at, updated_at, closed_at, is_closed, is_won';

const PAGE_SIZE = 1000;

function normalizeDeal(row) {
  // `status` is the label the UI renders and filters on, so it uses the app's
  // vocabulary (Closed/Axed), not Bitrix's won/lost columns it derives from.
  const status = row.is_won ? 'Closed' : row.is_closed ? 'Axed' : 'Active';

  return {
    id: row.deal_id,
    title: row.title || 'Untitled Deal',
    stageId: row.stage_id,
    stageLabel: getStageLabel(row.stage_id),
    categoryId: row.category_id,
    pipelineLabel: getPipelineLabel(row.category_id),
    ownerId: row.assigned_by_id,
    ownerLabel: getAssociateLabel(row.assigned_by_id),
    companyId: row.company_id,
    contactId: row.contact_id,
    clientLabel: getClientLabel(row.contact_id),
    clientStatus: getClientStatus(row.contact_id),
    amount: row.opportunity === null ? 0 : Number(row.opportunity),
    currency: row.currency_id || 'USD',
    createdAt: row.created_at,
    // The UTC day `createdAt` falls on. Precomputed here, once per fetch,
    // because the date-range filters run over every row on each keystroke and
    // would otherwise rebuild two Date objects per row per pass.
    createdDay: toDayString(row.created_at),
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
    isClosed: row.is_closed,
    isWon: row.is_won,
    status,
  };
}

/**
 * Fetches every deal from Supabase (paginating past PostgREST's per-request
 * row cap) and normalizes it into the shape the rest of the app consumes.
 * Cached by TanStack Query and shared across Dashboard/Deals/Associates/Analytics.
 */
export async function fetchAllDeals() {
  // normalizeDeal resolves owner/client labels, so the live name overlay has to
  // be in place first. Runs concurrently with the first page of deals rather
  // than serially -- it's 2 requests against Supabase's ~30.
  const liveNames = ensureLiveNames();

  const rows = [];
  let from = 0;

  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase.from('deals').select(LIST_COLUMNS).range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  await liveNames;
  return rows.map(normalizeDeal);
}
