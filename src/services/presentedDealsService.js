import { supabase } from '@/services/supabase';
import { ensureLiveNames } from '@/services/namesService';
import {
  fetchTransitionsFromStage,
  fetchTransitionsForDeals,
} from '@/services/stageHistoryService';
import {
  PRESENTED_DATE_FIELD,
  DEAL_TEAM_LEAD_FIELD,
  PRESENTATION_STAGE,
  PRESENTATION_OUTCOME_STAGES,
  PRESENTATION_REWORK_STAGES,
  getAssociateLabel,
  getClientLabel,
  getDealTeam,
} from '@/utils/dealMeta';

const PAGE_SIZE = 1000;

/**
 * A deal counts as presented when the associate filled in the Presented Date
 * custom field (see PRESENTED_DATE_FIELD). That single condition is applied at
 * the database level, so only the presented population (~6.5k rows) comes back
 * rather than the full 29k-deal table.
 *
 * This used to additionally require that `stage_transitions` show the deal
 * leaving Video Presentation, and counted a deal only when both signals agreed.
 * That dropped 108 deals whose date was set, and the drops were not the
 * data-quality disagreements the rule was meant to catch: 47 had simply not
 * moved on from Video Presentation yet, and 31 had exited to a stage missing
 * from the allowlist (HOLD, POST_SELLER, and the late-funnel stages were never
 * listed). Because a freshly-presented deal is the least likely to have exited
 * the stage, the undercount landed hardest on the most recent days -- the exact
 * figures anyone spot-checks against Bitrix. The date field is the associate's
 * explicit record that the presentation happened, so it is now the sole signal
 * and the numbers here match the Bitrix dashboard.
 */

async function fetchPaged(table, columns, applyFilters) {
  const rows = [];
  let from = 0;

  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await applyFilters(supabase.from(table).select(columns)).range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

/** Deals with a value in the Presented Date field. Bitrix writes an empty
 * string rather than null when the field is untouched, so both are excluded. */
async function fetchDealsWithPresentedDate() {
  return fetchPaged(
    'deals',
    `deal_id, assigned_by_id, contact_id, stage_id, ${PRESENTED_DATE_FIELD}, ${DEAL_TEAM_LEAD_FIELD}`,
    (query) => query.not(PRESENTED_DATE_FIELD, 'is', null).neq(PRESENTED_DATE_FIELD, '')
  );
}

/** Bitrix sends the Presented Date as a timestamp pinned to its server's
 * timezone ("2026-06-16T03:00:00+03:00" = midnight UTC on the 16th). Reduced
 * to a UTC calendar date so it compares against the page's date filter the
 * same way submissionsService derives `source_date`. */
function toPresentedDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

/**
 * How each deal's presentation was received -- 'accepted', 'rejected' or
 * 'onHold' per PRESENTATION_OUTCOME_STAGES -- keyed by deal id. (A rejection is
 * later split into 'autoAxed' by resolveOutcome; the stage history can't tell
 * the two apart.) Deals absent
 * from the map went nowhere conclusive and are counted under Presented only.
 *
 * Unlike the presented figure above, this does read `stage_transitions` -- the
 * pipeline history is the only record of what happened after the presentation.
 * It is not used to second-guess the Presented Date, so the undercount
 * described earlier doesn't apply: a deal missing from here still counts as
 * presented.
 *
 * 355 deals have left Video Presentation more than once, since Bitrix allows
 * moving a deal back for a re-presentation, and 28 of those exited to more than
 * one of these destinations. Counting every exit would put those deals in
 * several columns at once, so a deal's most recent exit decides -- where it
 * stands now rather than where it once was. Transitions are fetched
 * oldest-first, so the last row seen per deal is that exit.
 *
 * That most recent exit is not always conclusive: 20 deals were last sent
 * *back* to Valuation Modeling, M&A Associates Responsibilities or Valuation
 * Model For Review, which says the work needed redoing, not that the client
 * decided anything. Those deals are followed forward through the rest of their
 * pipeline history until they reach a stage that does decide (11 accepted, 7
 * rejected, 2 that have gone back into Video Presentation and are still open).
 */
async function fetchPresentationOutcomes() {
  // Every exit, not just the conclusive ones -- a rework move is the deal's
  // latest word on the presentation even though it decides nothing, so it has
  // to be visible here to take precedence over an older conclusive exit.
  const exits = await fetchTransitionsFromStage(PRESENTATION_STAGE);

  const reworkStages = new Set(PRESENTATION_REWORK_STAGES);
  const outcomes = new Map();
  const sentBackForRework = [];

  // Fetched oldest-first, so the last exit seen per deal is the most recent.
  const latestExit = new Map();
  for (const exit of exits) latestExit.set(exit.deal_id, exit);

  for (const [dealId, exit] of latestExit) {
    const outcome = PRESENTATION_OUTCOME_STAGES[exit.to_stage_id];
    if (outcome) outcomes.set(dealId, outcome);
    else if (reworkStages.has(exit.to_stage_id)) sentBackForRework.push(dealId);
  }

  if (sentBackForRework.length === 0) return outcomes;

  // Follow each reworked deal forward until it reaches a stage that does
  // decide something -- currently 56 deals, of which 20 are presented ones
  // this page counts, taking up to 5 hops to resolve. Deliberately not
  // narrowed to the presented set first: this map is keyed by deal and the
  // caller does the filtering, so keeping it independent costs one small
  // extra query and keeps the two concerns separate.
  const history = await fetchTransitionsForDeals(sentBackForRework);
  const byDeal = new Map();
  for (const transition of history) {
    if (!byDeal.has(transition.deal_id)) byDeal.set(transition.deal_id, []);
    byDeal.get(transition.deal_id).push(transition);
  }

  for (const dealId of sentBackForRework) {
    const chain = byDeal.get(dealId) ?? [];

    // Anchor on the deal's own last exit from Video Presentation rather than
    // on a timestamp, so transitions sharing a `left_at` can't be misordered.
    let lastExitIndex = -1;
    for (let i = chain.length - 1; i >= 0; i -= 1) {
      if (chain[i].from_stage_id === PRESENTATION_STAGE) {
        lastExitIndex = i;
        break;
      }
    }

    // First conclusive stage after the rework wins. Not the most recent one:
    // a deal that came back, reached Seller Call and was axed months later was
    // still accepted off the presentation, which is how a deal that went
    // straight to Seller Call and was axed already counts.
    for (const transition of chain.slice(lastExitIndex + 1)) {
      const outcome = PRESENTATION_OUTCOME_STAGES[transition.to_stage_id];
      if (outcome) {
        outcomes.set(dealId, outcome);
        break;
      }
    }
  }

  return outcomes;
}

/**
 * Fallback for presented deals whose exit from Video Presentation was never
 * recorded at all -- their history jumps straight from Valuation Modeling or
 * Valuation Model For Review to Seller Call, with no Video Presentation row
 * between. The presentation did happen (the associate set a Presented Date),
 * so the stage move is simply missing rather than the deal being unpresented.
 *
 * With no exit to anchor on, the deal's last move *out of* a rework stage
 * stands in for it, and the first conclusive stage from there decides -- the
 * same walk fetchPresentationOutcomes does, from a different starting point.
 * Deals with no rework exit either (deal 61031 and friends, whose only history
 * is a single still-open row) stay unclassified.
 */
async function fetchReworkFallbackOutcomes(dealIds) {
  if (dealIds.length === 0) return new Map();

  const history = await fetchTransitionsForDeals(dealIds);
  const byDeal = new Map();
  for (const transition of history) {
    if (!byDeal.has(transition.deal_id)) byDeal.set(transition.deal_id, []);
    byDeal.get(transition.deal_id).push(transition);
  }

  const reworkStages = new Set(PRESENTATION_REWORK_STAGES);
  const fallbacks = new Map();

  for (const dealId of dealIds) {
    const chain = byDeal.get(dealId) ?? [];

    let lastReworkExit = -1;
    for (let i = chain.length - 1; i >= 0; i -= 1) {
      if (reworkStages.has(chain[i].from_stage_id)) {
        lastReworkExit = i;
        break;
      }
    }
    if (lastReworkExit === -1) continue;

    // From the rework exit itself onward, so its own destination counts.
    for (const transition of chain.slice(lastReworkExit)) {
      const outcome = PRESENTATION_OUTCOME_STAGES[transition.to_stage_id];
      if (outcome) {
        fallbacks.set(dealId, outcome);
        break;
      }
    }
  }

  return fallbacks;
}

/**
 * Ids of the deals Bitrix marks "Reason for Axed" = "Auto-axed - Partner did not
 * respond for 1 week", or "Other - Internal" with the automation's "Automatically
 * Axed by Automation..." explanation. The `deals` table doesn't carry those
 * fields, so a refresh script copies the ids into `auto_axed_deals` (see
 * sql/auto-axed-deals.sql).
 *
 * A failed read degrades to an empty set rather than failing the page: the
 * presented figures don't depend on it, and the worst outcome is auto-axed deals
 * showing under plain Rejected until the table is there or the next load works.
 */
async function fetchAutoAxedDealIds() {
  try {
    const rows = await fetchPaged('auto_axed_deals', 'deal_id', (query) => query.order('deal_id'));
    return new Set(rows.map((row) => row.deal_id));
  } catch (error) {
    console.warn('Auto-axed deal list failed to load; they will count as plain Rejected.', error);
    return new Set();
  }
}

/**
 * Which column a presented deal belongs in: an outcome from the pipeline
 * history, 'awaiting' (still sitting in Video Presentation, no decision yet),
 * or null for a deal none of those describe.
 *
 * A recorded outcome outranks the current stage, because 51 presented deals
 * sit in Video Presentation today but 4 of them have already been through an
 * outcome exit and were moved back for a re-presentation. Reading the stage
 * first would pull those 4 back out of the columns they belong in; this way
 * Awaiting Response means "no decision on record yet", which is what makes it
 * a clean residual rather than an overlapping second reading.
 *
 * The rework fallback ranks below the current stage, not above it: a deal
 * sitting in Video Presentation right now is awaiting a response whatever an
 * older rework exit once led to.
 *
 * A rejection splits in two: one Bitrix marks auto-axed (the partner never
 * answered) becomes 'autoAxed' instead of 'rejected'. It is a separate bucket,
 * not a subset, so the two never overlap and Rejected excludes them. Only a
 * rejection is eligible -- the reason is read off a deal that was axed, so a
 * deal that merely carries it but whose latest exit from Video Presentation went
 * somewhere else stays where that exit put it.
 *
 * `null` is what's left after all of that -- deals whose only history is a
 * single still-open row, so there is nothing at all to read a verdict from.
 */
function resolveOutcome(deal, outcomes, reworkFallbacks, autoAxedIds) {
  const outcome = resolveBaseOutcome(deal, outcomes, reworkFallbacks);
  return outcome === 'rejected' && autoAxedIds.has(deal.deal_id) ? 'autoAxed' : outcome;
}

function resolveBaseOutcome(deal, outcomes, reworkFallbacks) {
  const recorded = outcomes.get(deal.deal_id);
  if (recorded) return recorded;
  if (deal.stage_id === PRESENTATION_STAGE) return 'awaiting';
  return reworkFallbacks.get(deal.deal_id) ?? null;
}

/**
 * Every presented deal, resolved to the associate and client names the
 * Presented Deals page groups by, plus how the presentation was received.
 */
export async function fetchPresentedDeals() {
  // Associate/client labels below come from the name registry; see
  // namesService for why this has to resolve before rows are mapped.
  const [datedDeals, outcomes, autoAxedIds] = await Promise.all([
    fetchDealsWithPresentedDate(),
    fetchPresentationOutcomes(),
    fetchAutoAxedDealIds(),
    ensureLiveNames(),
  ]);

  // Only the deals the rules above couldn't place need their full history
  // read, which keeps this second round trip to a few dozen ids.
  const unresolved = datedDeals
    .filter(
      (deal) =>
        !outcomes.has(deal.deal_id) && deal.stage_id !== PRESENTATION_STAGE
    )
    .map((deal) => deal.deal_id);
  const reworkFallbacks = await fetchReworkFallbackOutcomes(unresolved);

  // The ids and the untouched Presented Date are carried alongside the resolved
  // labels purely so the page's export can show what each figure was counted
  // from; nothing in the counting reads them.
  return datedDeals.map((deal) => {
    const associateName = getAssociateLabel(deal.assigned_by_id);
    return {
      dealId: deal.deal_id,
      presentedDate: toPresentedDate(deal[PRESENTED_DATE_FIELD]),
      presentedDateRaw: deal[PRESENTED_DATE_FIELD],
      assignedById: deal.assigned_by_id,
      contactId: deal.contact_id,
      stageId: deal.stage_id,
      associateName,
      clientName: getClientLabel(deal.contact_id),
      // The deal's own team lead wins over the owner's roster team, so the team
      // belongs to the deal rather than to the associate (see getDealTeam).
      teamLeadId: deal[DEAL_TEAM_LEAD_FIELD],
      team: getDealTeam(deal[DEAL_TEAM_LEAD_FIELD], associateName),
      outcome: resolveOutcome(deal, outcomes, reworkFallbacks, autoAxedIds),
    };
  });
}
