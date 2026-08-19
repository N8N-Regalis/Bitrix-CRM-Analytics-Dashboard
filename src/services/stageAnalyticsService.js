import { STAGE_ORDER, getStageLabel, isRealStage } from '@/utils/dealMeta';
import { ordinalFill } from '@/utils/ordinalColor';

/** Avg time spent in each stage, in funnel order (not by duration) so the
 * ordinal color ramp reads as "further along the pipeline" — mirrors
 * getStageDistribution in dashboardService.js. */
export function getStageDurationChartData(stats) {
  const byStage = new Map(
    stats.filter((row) => isRealStage(row.stage_id)).map((row) => [row.stage_id, row]),
  );

  const orderedIds = STAGE_ORDER.filter((id) => byStage.has(id));
  const unknownIds = [...byStage.keys()].filter((id) => !STAGE_ORDER.includes(id));
  const allIds = [...orderedIds, ...unknownIds];

  return allIds.map((stageId, index) => ({
    name: getStageLabel(stageId),
    value: Number(byStage.get(stageId).avg_duration_days),
    count: byStage.get(stageId).transition_count,
    fill: ordinalFill(index, allIds.length),
  }));
}

/** Overall avg time-in-stage across every stage, weighted by how many
 * transitions were observed for each (an unweighted mean would let a
 * rarely-used stage skew the headline number as much as the busiest one). */
export function getOverallAvgDurationDays(stats) {
  let totalDays = 0;
  let totalCount = 0;
  for (const row of stats) {
    if (!isRealStage(row.stage_id)) continue;
    totalDays += Number(row.avg_duration_days) * row.transition_count;
    totalCount += row.transition_count;
  }
  return totalCount > 0 ? totalDays / totalCount : null;
}

/** Transitions with either leg on a non-existent stage dropped — see isRealStage. */
export function getDisplayTransitions(topTransitions) {
  return topTransitions.filter(
    (row) => isRealStage(row.from_stage_id) && isRealStage(row.to_stage_id),
  );
}

export function getMostCommonTransition(topTransitions) {
  const transitions = getDisplayTransitions(topTransitions);
  if (!transitions.length) return null;
  const top = transitions[0];
  return {
    fromLabel: getStageLabel(top.from_stage_id),
    toLabel: getStageLabel(top.to_stage_id),
    count: top.transition_count,
  };
}

const MS_PER_DAY = 86400000;

/** The sync server frequently fails to set to_stage_id when a deal reaches
 * WON/LOST, so most "openRows" (to_stage_id IS NULL) actually belong to
 * deals that are already closed in the deals table, not still-open ones.
 * True only when dealsById confirms the row's deal exists and is still active
 * (neither won nor lost); deal_ids with no match in dealsById (orphaned/deleted
 * deal references) are treated as not verifiably active. */
function isRowForActiveDeal(row, dealsById) {
  const deal = dealsById.get(row.deal_id);
  return deal ? !deal.isClosed && !deal.isWon : false;
}

/** Currently-open stage rows enriched with deal context and days-stalled,
 * sorted longest-stalled first. dealsById is the existing cached deals
 * dataset (useDealsQuery) keyed by deal_id, so no second deals fetch is
 * needed just to show a title/owner/client — it's also now what filters
 * openRows down to rows whose deal is confirmed still-open (see
 * isRowForActiveDeal above).
 * @param {Map<number, string>} lastActivityDates - Optional map of deal ID to last activity START_TIME from Bitrix timeline */
export function getStalledDeals(openRows, dealsById, limit = 20, lastActivityDates = null) {
  const now = Date.now();
  const activeOpenRows = openRows.filter((row) => isRowForActiveDeal(row, dealsById));

  return activeOpenRows
    .map((row) => {
      const deal = dealsById.get(row.deal_id);
      const daysInStage = (now - new Date(row.entered_at).getTime()) / MS_PER_DAY;
      return {
        dealId: row.deal_id,
        title: deal.title,
        ownerLabel: deal.ownerLabel,
        clientLabel: deal.clientLabel,
        stageLabel: getStageLabel(row.from_stage_id),
        enteredAt: row.entered_at,
        daysInStage,
        updatedAt: lastActivityDates?.get(row.deal_id) || deal.updatedAt,
      };
    })
    .sort((a, b) => b.daysInStage - a.daysInStage)
    .slice(0, limit);
}

/** Count of active-deal openRows stalled cutoffDays+ in their current
 * stage. Needs dealsById for the same reason getStalledDeals does — most
 * openRows are orphaned rows left behind on deals that already closed
 * (see isRowForActiveDeal), not currently-open deals, so counting raw
 * openRows wildly overcounts. */
export function countStalledDeals(openRows, dealsById, cutoffDays = 14) {
  const now = Date.now();
  const cutoffMs = cutoffDays * MS_PER_DAY;
  return openRows
    .filter((row) => isRowForActiveDeal(row, dealsById))
    .filter((row) => now - new Date(row.entered_at).getTime() >= cutoffMs).length;
}

/** Stages to exclude from the active pipeline view */
const EXCLUDED_STAGES = new Set(['HOLD', 'LOSE', 'WON']);

function isActiveStage(stageId) {
  return !EXCLUDED_STAGES.has(stageId);
}

/** Currently-open stage rows enriched with deal context and days-stalled,
 * excluding deals in On Hold, Axed, or Deal Closed stages.
 * Sorted longest-stalled first.
 * @param {Map<number, string>} lastActivityDates - Optional map of deal ID to last activity START_TIME from Bitrix timeline */
export function getActiveStalledDeals(openRows, dealsById, limit = 20, lastActivityDates = null) {
  const now = Date.now();
  const activeOpenRows = openRows.filter((row) => isRowForActiveDeal(row, dealsById) && isActiveStage(row.from_stage_id));

  return activeOpenRows
    .map((row) => {
      const deal = dealsById.get(row.deal_id);
      const daysInStage = (now - new Date(row.entered_at).getTime()) / MS_PER_DAY;
      return {
        dealId: row.deal_id,
        title: deal.title,
        ownerLabel: deal.ownerLabel,
        clientLabel: deal.clientLabel,
        stageLabel: getStageLabel(row.from_stage_id),
        enteredAt: row.entered_at,
        daysInStage,
        updatedAt: lastActivityDates?.get(row.deal_id) || deal.updatedAt,
      };
    })
    .sort((a, b) => b.daysInStage - a.daysInStage)
    .slice(0, limit);
}

/** Count of active-deal openRows in active pipeline stages,
 * excluding On Hold, Axed, and Deal Closed. */
export function countActiveStalledDeals(openRows, dealsById, cutoffDays = 14) {
  const now = Date.now();
  const cutoffMs = cutoffDays * MS_PER_DAY;
  return openRows
    .filter((row) => isRowForActiveDeal(row, dealsById))
    .filter((row) => isActiveStage(row.from_stage_id))
    .filter((row) => now - new Date(row.entered_at).getTime() >= cutoffMs).length;
}

/** Filter transitions by date range (left_at field).
 * fromDate and toDate should be ISO date strings (YYYY-MM-DD) or null. */
function filterTransitionsByDateRange(transitions, fromDate, toDate) {
  return transitions.filter((transition) => {
    if (!transition.left_at) return false;
    const transitionDate = new Date(transition.left_at).toISOString().split('T')[0];
    if (fromDate && transitionDate < fromDate) return false;
    if (toDate && transitionDate > toDate) return false;
    return true;
  });
}

/** Filter open rows by date range (entered_at field).
 * fromDate and toDate should be ISO date strings (YYYY-MM-DD) or null. */
function filterOpenRowsByDateRange(openRows, fromDate, toDate) {
  return openRows.filter((row) => {
    if (!row.entered_at) return false;
    const rowDate = new Date(row.entered_at).toISOString().split('T')[0];
    if (fromDate && rowDate < fromDate) return false;
    if (toDate && rowDate > toDate) return false;
    return true;
  });
}

/** Get Valuation Modeling stage movement analysis by Associate.
 * Shows distinct deals moved from Valuation Modeling to Model Review/Axed,
 * plus deals still in Valuation Modeling stage.
 * Can filter by date range (fromDate/toDate as ISO date strings YYYY-MM-DD). */
export function getValuationModelingByAssociate(
  transitions,
  openRows,
  dealsById,
  fromStage = 'FINANCIAL_MODEL',
  toStageModelReview = 'MODEL_REVIEW',
  toStageAxed = 'LOSE',
  fromDate = null,
  toDate = null,
) {
  const filteredTransitions = filterTransitionsByDateRange(transitions, fromDate, toDate);
  const filteredOpenRows = filterOpenRowsByDateRange(openRows, fromDate, toDate);

  const byAssociate = new Map();

  // Group open rows (still in FINANCIAL_MODEL) by associate
  for (const row of filteredOpenRows) {
    if (row.from_stage_id !== fromStage) continue;
    const deal = dealsById.get(row.deal_id);
    if (!deal || deal.isClosed || deal.isWon) continue;

    if (!byAssociate.has(deal.ownerLabel)) {
      byAssociate.set(deal.ownerLabel, {
        associate: deal.ownerLabel,
        movedToReview: 0,
        movedToAxed: 0,
        stillInStage: 0,
        reviewDealIds: new Set(),
        axedDealIds: new Set(),
        stageDealIds: new Set(),
      });
    }

    const entry = byAssociate.get(deal.ownerLabel);
    entry.stillInStage += 1;
    entry.stageDealIds.add(row.deal_id);
  }

  // Group completed transitions by associate
  for (const transition of filteredTransitions) {
    if (transition.from_stage_id !== fromStage) continue;

    const deal = dealsById.get(transition.deal_id);
    if (!deal) continue;

    if (!byAssociate.has(deal.ownerLabel)) {
      byAssociate.set(deal.ownerLabel, {
        associate: deal.ownerLabel,
        movedToReview: 0,
        movedToAxed: 0,
        stillInStage: 0,
        reviewDealIds: new Set(),
        axedDealIds: new Set(),
        stageDealIds: new Set(),
      });
    }

    const entry = byAssociate.get(deal.ownerLabel);

    if (transition.to_stage_id === toStageModelReview) {
      entry.reviewDealIds.add(transition.deal_id);
    } else if (transition.to_stage_id === toStageAxed) {
      entry.axedDealIds.add(transition.deal_id);
    }
  }

  // Convert Sets to arrays with deal details and sort by associate name
  const result = Array.from(byAssociate.values())
    .map((entry) => ({
      associate: entry.associate,
      movedToReviewCount: entry.reviewDealIds.size,
      movedToReviewIds: Array.from(entry.reviewDealIds).sort((a, b) => a - b),
      movedToAxedCount: entry.axedDealIds.size,
      movedToAxedIds: Array.from(entry.axedDealIds).sort((a, b) => a - b),
      stillInStageCount: entry.stageDealIds.size,
      stillInStageIds: Array.from(entry.stageDealIds).sort((a, b) => a - b),
    }))
    .sort((a, b) => a.associate.localeCompare(b.associate));

  return result;
}
