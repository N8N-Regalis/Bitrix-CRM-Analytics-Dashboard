import { getAssociateLabel, getPipelineLabel } from '@/utils/dealMeta';
import { isInactiveAssociate, liveTeamLeadIds, lookupAssociateTeamLeadId } from '@/utils/nameRegistry';
import { getRecentMonths, getAssociatePerformance } from '@/services/dashboardService';

export function getConversionRate(deals) {
  const won = deals.filter((d) => d.status === 'Closed').length;
  const lost = deals.filter((d) => d.status === 'Axed').length;
  const closed = won + lost;
  return {
    rate: closed > 0 ? (won / closed) * 100 : 0,
    won,
    lost,
    closed,
  };
}

export function getMonthlyGrowth(deals, monthsBack = 6) {
  const months = getRecentMonths(monthsBack);
  const counts = new Map(months.map((m) => [m.key, 0]));

  for (const deal of deals) {
    const date = new Date(deal.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  }

  return months.map((m, index) => {
    const current = counts.get(m.key) ?? 0;
    // null only means "no prior month in this window" (the first point).
    // A previous count of exactly 0 is a real value, not a missing one —
    // 0 -> 0 is 0% change, not "unknown".
    let growth = null;
    if (index > 0) {
      const previous = counts.get(months[index - 1].key) ?? 0;
      if (previous === 0) {
        growth = current === 0 ? 0 : null; // 0 -> N is an undefined ratio, not a percentage
      } else {
        growth = ((current - previous) / previous) * 100;
      }
    }
    return { month: m.label, deals: current, growth };
  });
}

export const getDealsByAssociate = getAssociatePerformance;

export function getDealsByPipeline(deals) {
  const counts = new Map();
  for (const deal of deals) {
    counts.set(deal.categoryId, (counts.get(deal.categoryId) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([categoryId, value]) => ({ name: getPipelineLabel(categoryId), value }))
    .sort((a, b) => b.value - a.value);
}

const AGING_BUCKETS = [
  { label: '0-7 days', min: 0, max: 7 },
  { label: '8-14 days', min: 8, max: 14 },
  { label: '15-30 days', min: 15, max: 30 },
  { label: '31-60 days', min: 31, max: 60 },
  { label: '61-90 days', min: 61, max: 90 },
  { label: '90+ days', min: 91, max: Infinity },
];

export function getDealAging(deals) {
  const openDeals = deals.filter((d) => d.status === 'Active');
  const now = Date.now();

  const buckets = AGING_BUCKETS.map((bucket) => ({ label: bucket.label, deals: 0 }));

  for (const deal of openDeals) {
    const created = new Date(deal.createdAt).getTime();
    if (Number.isNaN(created)) continue;
    const ageDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    const bucketIndex = AGING_BUCKETS.findIndex((b) => ageDays >= b.min && ageDays <= b.max);
    if (bucketIndex >= 0) buckets[bucketIndex].deals += 1;
  }

  return buckets;
}

export function getWinLossRatio(deals) {
  const won = deals.filter((d) => d.status === 'Closed').length;
  const lost = deals.filter((d) => d.status === 'Axed').length;
  return {
    won,
    lost,
    ratio: lost > 0 ? won / lost : won > 0 ? Infinity : 0,
    data: [
      { name: 'Closed', value: won, fill: 'var(--status-good)' },
      { name: 'Axed', value: lost, fill: 'var(--status-critical)' },
    ],
  };
}

export function getMonthlyTrend(deals, monthsBack = 12) {
  const months = getRecentMonths(monthsBack);
  const buckets = new Map(months.map((m) => [m.key, { created: 0, won: 0, lost: 0 }]));

  for (const deal of deals) {
    const date = new Date(deal.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (!buckets.has(key)) continue;
    const bucket = buckets.get(key);
    bucket.created += 1;
    if (deal.status === 'Closed') bucket.won += 1;
    else if (deal.status === 'Axed') bucket.lost += 1;
  }

  return months.map((m) => ({ month: m.label, ...buckets.get(m.key) }));
}

// Deals whose owner has nobody above them are kept as rows rather than dropped
// -- they are roughly a quarter of the table, and omitting that much would make
// the team totals look like the whole business. They split three ways because
// one bucket was hiding three unrelated situations: work awaiting a data fix,
// work belonging to people who have left, and work no person did at all.
export const TEAM_ADMIN = 'Admin User';
export const TEAM_INACTIVE = 'Inactive Users';
export const NO_TEAM_LEAD = 'No Team Lead';

// Bitrix reserves user id 1 for the portal admin, which on this account is the
// automation user that creates deals programmatically. Checked before the
// inactive test because the account is very much active -- it just isn't a
// person, so its work does not belong in a human-performance breakdown.
const ADMIN_ASSOCIATE_ID = 1;

const UNLED_LABELS = {
  admin: TEAM_ADMIN,
  inactive: TEAM_INACTIVE,
  none: NO_TEAM_LEAD,
};

/** Which catch-all row a deal falls into once no team lead resolves. Order is
 * load-bearing: the admin account is active, so testing it second would file
 * every automated deal under a person's bucket. */
function unledBucket(ownerId) {
  if (Number(ownerId) === ADMIN_ASSOCIATE_ID) return 'admin';
  if (isInactiveAssociate(ownerId)) return 'inactive';
  return 'none';
}

/**
 * Deals grouped by the team lead above each deal's owner, mirroring
 * getAssociatePerformance's shape so the same stacked bar renders it.
 *
 * Two rules worth knowing, both of which change the numbers materially:
 *
 * 1. A lead's own deals count toward their own team. Leads carry a book of
 *    business themselves but have an empty team_leader_id, so grouping purely
 *    on that field files their work under "no team lead" -- which had Racquel's
 *    team showing 137 deals while her own 965 sat in the catch-all bucket.
 * 2. The catch-all rows sort last regardless of size, so the actual teams read
 *    in volume order rather than being split around them.
 *
 * Note that an inactive associate who DOES have a lead still counts toward that
 * lead's team -- they were on it. Only the unled remainder splits out.
 */
export function getDealsByTeamLead(deals) {
  const leadIds = liveTeamLeadIds();
  const byLead = new Map();

  for (const deal of deals) {
    // A lead is their own lead (rule 1); everyone else defers to the registry.
    const leadId = leadIds.has(deal.ownerId) ? deal.ownerId : lookupAssociateTeamLeadId(deal.ownerId);
    const key = leadId ?? unledBucket(deal.ownerId);

    if (!byLead.has(key)) {
      byLead.set(key, {
        teamLead: leadId ? getAssociateLabel(leadId) : UNLED_LABELS[key],
        leadId: leadId ?? null,
        total: 0,
        won: 0,
        lost: 0,
        active: 0,
      });
    }

    const bucket = byLead.get(key);
    bucket.total += 1;
    if (deal.status === 'Closed') bucket.won += 1;
    else if (deal.status === 'Axed') bucket.lost += 1;
    else bucket.active += 1;
  }

  return [...byLead.values()]
    .map((row) => ({
      ...row,
      winRate: row.won + row.lost > 0 ? (row.won / (row.won + row.lost)) * 100 : 0,
    }))
    .sort((a, b) => {
      // Real teams first, then the catch-alls, each group by volume. Comparing
      // the flags rather than short-circuiting on `a` keeps this a consistent
      // comparator now that two catch-all rows can meet each other.
      const aUnled = a.leadId === null;
      const bUnled = b.leadId === null;
      if (aUnled !== bUnled) return aUnled ? 1 : -1; // rule 2
      return b.total - a.total;
    });
}
