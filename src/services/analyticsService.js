import { getPipelineLabel } from '@/utils/dealMeta';
import { getRecentMonths, getAssociatePerformance } from '@/services/dashboardService';

export function getConversionRate(deals) {
  const won = deals.filter((d) => d.status === 'Won').length;
  const lost = deals.filter((d) => d.status === 'Lost').length;
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
  const won = deals.filter((d) => d.status === 'Won').length;
  const lost = deals.filter((d) => d.status === 'Lost').length;
  return {
    won,
    lost,
    ratio: lost > 0 ? won / lost : won > 0 ? Infinity : 0,
    data: [
      { name: 'Won', value: won, fill: 'var(--status-good)' },
      { name: 'Lost', value: lost, fill: 'var(--status-critical)' },
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
    if (deal.status === 'Won') bucket.won += 1;
    else if (deal.status === 'Lost') bucket.lost += 1;
  }

  return months.map((m) => ({ month: m.label, ...buckets.get(m.key) }));
}

// Bitrix has no team-lead hierarchy synced into Supabase yet, so this
// breakdown genuinely cannot be computed. Returning null keeps the gap
// explicit instead of silently duplicating the by-associate chart.
export function getDealsByTeamLead() {
  return null;
}
