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

export function getDealsPerMonth(deals, monthsBack = 12) {
  const months = getRecentMonths(monthsBack);
  const counts = new Map(months.map((m) => [m.key, 0]));

  for (const deal of deals) {
    const date = new Date(deal.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  }

  return months.map((m) => ({ month: m.label, deals: counts.get(m.key) ?? 0 }));
}

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Builds the last `count` calendar days (oldest first), including today. */
export function getRecentDays(count) {
  const days = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push({
      key: dayKey(date),
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    });
  }
  return days;
}

export function getDealsPerDay(deals, daysBack = 30) {
  const days = getRecentDays(daysBack);
  const counts = new Map(days.map((d) => [d.key, 0]));

  for (const deal of deals) {
    const date = new Date(deal.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = dayKey(date);
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  }

  return days.map((d) => ({ day: d.label, deals: counts.get(d.key) ?? 0 }));
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
