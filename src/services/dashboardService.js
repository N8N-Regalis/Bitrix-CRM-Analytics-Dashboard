import {
  STAGE_ORDER,
  getStageLabel,
  getClientLabel,
  getClientStatus,
  getClientDealFlowStart,
} from '@/utils/dealMeta';
import { CLIENT_STATUS_ORDER } from '@/utils/clientFields';
import { liveClientIds } from '@/utils/nameRegistry';
import { ordinalFill } from '@/utils/ordinalColor';

// This is a horizontal bar list colored by a single-hue ordinal ramp, not a
// categorical palette — the "~8 distinguishable hues" ceiling that applies to
// pies/donuts doesn't apply here, so this cap only exists as a safety net
// against a runaway number of pipeline stages, not a readability limit.
const MAX_STAGE_SEGMENTS = 20;

export function getKpis(deals) {
  const total = deals.length;
  let won = 0;
  let lost = 0;
  for (const deal of deals) {
    if (deal.status === 'Closed') won += 1;
    else if (deal.status === 'Axed') lost += 1;
  }
  return { total, active: total - won - lost, won, lost };
}

/** Builds the last `count` calendar months (oldest first), including the current month. */
export function getRecentMonths(count) {
  const months = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      year: date.getFullYear(),
      month: date.getMonth(),
    });
  }
  return months;
}

// --- Trend chart windows -----------------------------------------------------
//
// Both the buckets and the rows that land in them are keyed by `deal.createdDay`
// -- the UTC day the date-range filters also test. These charts used to bucket
// by local time (`new Date(deal.createdAt).getDate()`), which was self-consistent
// while the window was always "the last N days from now", but stopped being so
// once the Dashboard gained a filter: a deal created at 02:00 UTC counts as the
// previous day locally, so a range-derived window could drop a deal the KPI
// cards beside it still counted. One basis end to end keeps the two agreeing.
//
// `getRecentMonths` above is left on its own local basis because analyticsService
// builds its own series from it; nothing here reads it any more.

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 24 * 60 * 60 * 1000;

/** Today as `yyyy-mm-dd`, UTC -- the same basis as `deal.createdDay`. */
function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(day, delta) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function addMonths(key, delta) {
  const [year, month] = key.split('-').map(Number);
  const total = year * 12 + (month - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** `Aug 21`, read off the string so no timezone can shift the day. */
function dayLabel(day) {
  const [, month, date] = day.split('-');
  return `${MONTH_ABBR[Number(month) - 1]} ${Number(date)}`;
}

/** `Aug 25` from a `yyyy-mm` key -- the format the month axis has always used.
 * Exported alongside monthWindow below so any monthly series -- including the
 * Presented Deals page's, built from a different table entirely -- lands on the
 * same buckets and the same axis labels as the ones here. */
export function monthLabel(key) {
  const [year, month] = key.split('-');
  return `${MONTH_ABBR[Number(month) - 1]} ${year.slice(2)}`;
}

/**
 * Inclusive day count between two `yyyy-mm-dd` bounds, so a caller can size a
 * range before deciding whether a per-day chart is worth rendering. Reversed or
 * unparseable bounds count as zero rather than going negative.
 */
export function countDaysInRange(dateFrom, dateTo) {
  const from = Date.parse(`${dateFrom}T00:00:00Z`);
  const to = Date.parse(`${dateTo}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return 0;
  return Math.round((to - from) / DAY_MS) + 1;
}

/**
 * The buckets a trend chart should show: the applied range when there is one,
 * otherwise the trailing window ending today. Bounds arrive already resolved
 * (see resolveDateRange), so they are complete `yyyy-mm-dd` strings and compare
 * lexicographically -- reversed bounds simply yield no buckets, matching the
 * empty result the same pair produces everywhere else.
 */
function dayWindow({ daysBack = 30, dateFrom = null, dateTo = null }) {
  const days = [];
  if (dateFrom && dateTo) {
    for (let day = dateFrom; day <= dateTo; day = addDays(day, 1)) days.push(day);
    return days;
  }
  const end = todayUtc();
  for (let i = daysBack - 1; i >= 0; i -= 1) days.push(addDays(end, -i));
  return days;
}

export function monthWindow({ monthsBack = 12, dateFrom = null, dateTo = null }) {
  const months = [];
  if (dateFrom && dateTo) {
    const end = dateTo.slice(0, 7);
    for (let key = dateFrom.slice(0, 7); key <= end; key = addMonths(key, 1)) months.push(key);
    return months;
  }
  const end = todayUtc().slice(0, 7);
  for (let i = monthsBack - 1; i >= 0; i -= 1) months.push(addMonths(end, -i));
  return months;
}

export function getDealsPerMonth(deals, window = {}) {
  const months = monthWindow(window);
  const counts = new Map(months.map((key) => [key, 0]));

  for (const deal of deals) {
    const key = deal.createdDay?.slice(0, 7);
    if (key && counts.has(key)) counts.set(key, counts.get(key) + 1);
  }

  return months.map((key) => ({ month: monthLabel(key), deals: counts.get(key) }));
}

export function getDealsPerDay(deals, window = {}) {
  const days = dayWindow(window);
  const counts = new Map(days.map((day) => [day, 0]));

  for (const deal of deals) {
    if (deal.createdDay && counts.has(deal.createdDay)) {
      counts.set(deal.createdDay, counts.get(deal.createdDay) + 1);
    }
  }

  return days.map((day) => ({ day: dayLabel(day), deals: counts.get(day) }));
}

/** Deals grouped by stage, in funnel order (not by count) so the ordinal
 * color ramp reads as "further along the pipeline", not an arbitrary sort. */
export function getStageDistribution(deals) {
  const counts = new Map();
  for (const deal of deals) {
    counts.set(deal.stageId, (counts.get(deal.stageId) || 0) + 1);
  }

  const orderedIds = STAGE_ORDER.filter((id) => counts.has(id));
  const unknownIds = [...counts.keys()].filter((id) => !STAGE_ORDER.includes(id));
  const allIds = [...orderedIds, ...unknownIds];

  const overflow = allIds.length > MAX_STAGE_SEGMENTS;
  const visibleIds = overflow ? allIds.slice(0, MAX_STAGE_SEGMENTS - 1) : allIds;
  const overflowIds = overflow ? allIds.slice(MAX_STAGE_SEGMENTS - 1) : [];

  const result = visibleIds.map((stageId, index) => ({
    name: getStageLabel(stageId),
    value: counts.get(stageId),
    fill: ordinalFill(index, visibleIds.length),
  }));

  if (overflowIds.length > 0) {
    result.push({
      name: 'Other',
      value: overflowIds.reduce((sum, id) => sum + counts.get(id), 0),
      fill: 'hsl(var(--muted-foreground))',
    });
  }

  return result;
}

/** Client contacts grouped by lifecycle status, in funnel order (see
 * CLIENT_STATUS_ORDER) so the ordinal color ramp reads as "further along",
 * not an arbitrary sort. Takes already-deduped client rows (one per
 * contactId, e.g. from getClientPerformance), not raw deals, since status is
 * a per-contact attribute. Every real status is well under the ordinal
 * ramp's step count, so no overflow/"Other" bucket is needed here. */
export function getClientStatusDistribution(clients) {
  const counts = new Map();
  for (const client of clients) {
    const status = client.status || 'Unassigned';
    counts.set(status, (counts.get(status) || 0) + 1);
  }

  const orderedStatuses = CLIENT_STATUS_ORDER.filter((status) => counts.has(status));
  const unknownStatuses = [...counts.keys()].filter((status) => !CLIENT_STATUS_ORDER.includes(status));
  const allStatuses = [...orderedStatuses, ...unknownStatuses];

  return allStatuses.map((status, index) => ({
    name: status,
    value: counts.get(status),
    fill: ordinalFill(index, allStatuses.length),
  }));
}

export function getAssociatePerformance(deals, limit = 10) {
  const byOwner = new Map();

  for (const deal of deals) {
    const key = deal.ownerId ?? 'unassigned';
    if (!byOwner.has(key)) {
      byOwner.set(key, { associate: deal.ownerLabel, ownerId: deal.ownerId, total: 0, won: 0, lost: 0, active: 0 });
    }
    const bucket = byOwner.get(key);
    bucket.total += 1;
    if (deal.status === 'Closed') bucket.won += 1;
    else if (deal.status === 'Axed') bucket.lost += 1;
    else bucket.active += 1;
  }

  return [...byOwner.values()]
    .map((row) => ({
      ...row,
      winRate: row.won + row.lost > 0 ? (row.won / (row.won + row.lost)) * 100 : 0,
      axedRate: row.total > 0 ? (row.lost / row.total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

/** Deals grouped by client contact — mirrors getAssociatePerformance but
 * keyed by contactId/clientLabel instead of ownerId/ownerLabel. Also seeds a
 * zero-deal row for every known Bitrix contact that has no deal yet (e.g.
 * still in "Setting Up" status, before deal flow starts) — those clients
 * would otherwise never appear anywhere in status-based views (KPIs,
 * distribution chart, filter) since they don't come through `deals` at all. */
export function getClientPerformance(deals, limit = 10) {
  const byClient = new Map();

  for (const deal of deals) {
    const key = deal.contactId ?? 'none';
    if (!byClient.has(key)) {
      byClient.set(key, {
        client: deal.clientLabel,
        contactId: deal.contactId,
        status: deal.clientStatus,
        // Looked up here rather than carried on every normalized deal the way
        // clientStatus is: it's a per-contact attribute with one consumer (the
        // Clients table), so copying it onto all ~30k deal rows would buy
        // nothing. Same lookup either way -- both read the client roster.
        dealFlowStart: getClientDealFlowStart(deal.contactId),
        total: 0,
        won: 0,
        lost: 0,
        active: 0,
      });
    }
    const bucket = byClient.get(key);
    bucket.total += 1;
    if (deal.status === 'Closed') bucket.won += 1;
    else if (deal.status === 'Axed') bucket.lost += 1;
    else bucket.active += 1;
  }

  for (const contactId of liveClientIds()) {
    const id = Number(contactId);
    if (!byClient.has(id)) {
      byClient.set(id, {
        client: getClientLabel(id),
        contactId: id,
        status: getClientStatus(id),
        dealFlowStart: getClientDealFlowStart(id),
        total: 0,
        won: 0,
        lost: 0,
        active: 0,
      });
    }
  }

  return [...byClient.values()]
    .map((row) => ({
      ...row,
      winRate: row.won + row.lost > 0 ? (row.won / (row.won + row.lost)) * 100 : 0,
      axedRate: row.total > 0 ? (row.lost / row.total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export function getRecentDeals(deals, limit = 8) {
  return [...deals]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
